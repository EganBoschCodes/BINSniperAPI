const axios = require('axios');
const Helpers = require('./helpers');


let THREAD_HALTED = [];

module.exports = {
    AH_INITIALIZED: false,
    AH_DELAY: 0,
    AH_PAGE_ON: 0,
    AH_PAGES_DONE: 0,
    AH_PAGES_NEEDED: 1000,
    FULLY_REFRESHED: true,

    potential_early_trades: [],

    PRICE_TRACKER: null,

    threadsCompleted: () => {
        let result = true;
        for (let i in THREAD_HALTED) {
            result = result && THREAD_HALTED[i];
        }
        return result;
    },

    pullAHData: async (timeStamp, persistent_ah) => {
        module.exports.FULLY_REFRESHED = false;
        module.exports.potential_early_trades = [];

        Helpers.log("Starting AH Pull...");
        module.exports.AH_PAGES_DONE = 0;
        module.exports.AH_PAGES_NEEDED = 1000;
        module.exports.AH_PAGE_ON = 0;

        let ah = new AuctionHouse();
        let i = 0;
        Helpers.log("\n\n\n\n");
        process.stdout.write("Progress: 0/" + ah.target);

        for (let i = 0; i < 8; i++) {
            getAuctionPageHTTP(ah, i, timeStamp, persistent_ah);
            THREAD_HALTED[i] = false;
            await sleep(10);
        }

        while (!module.exports.threadsCompleted()) {
            await sleep(5);
        }

        ah.prune();


        module.exports.AH_DELAY = Date.now() - ah.lastUpdated;
        process.stdout.write("\n");

        Helpers.log("Time taken: " + (Date.now() - ah.lastUpdated) / 1000 + " sec")
        Helpers.log("AH DATA TIMESTAMP: " + ah.lastUpdated);
        module.exports.AH_INITIALIZED = true;
        
        module.exports.FULLY_REFRESHED = true;
        if(!module.exports.PRICE_TRACKER) {
            module.exports.PRICE_TRACKER = new PriceTracker();
        }
        return ah;
    },

    getAPITimeStamp: async () => {
        let page = await axios.get('https://api.hypixel.net/skyblock/auctions_ended');
        return page.data.success ? page.data.lastUpdated : 0;
	}

    
}

let getAuctionPageHTTP = async (ah, id, timeStamp, persistent_ah) => {

    let page = module.exports.AH_PAGE_ON;
    module.exports.AH_PAGE_ON++;

    try {
        let response = await axios.get('https://api.hypixel.net/skyblock/auctions?page=' + page);

        if (!response.data.success) {
            Helpers.log(response.data);
            Helpers.log("PAGE " + page + " DOESN'T EXIST");
            return;
        }

        while (response.data.timeStamp < timeStamp) {

            ah.target = Math.min(ah.target, response.data.totalPages);
            module.exports.AH_PAGES_NEEDED = ah.target;
            response = await axios.get('https://api.hypixel.net/skyblock/auctions?page=' + page);

            if (!response.data.success) {
                Helpers.log(response.data);
                Helpers.log("PAGE " + page + " DOESN'T EXIST");
                return;
            }

        }

        module.exports.AH_PAGES_DONE = ah.pagesPopulated + 1;
        ah.populate(response.data);

        if(persistent_ah && persistent_ah.earlyScan) {
            let early_auctions = await persistent_ah.earlyScan(response.data)

            early_auctions.forEach((a) => {module.exports.potential_early_trades.push(a);})
            
        }
        

        if (module.exports.AH_PAGE_ON < ah.target) {
            await getAuctionPageHTTP(ah, id, timeStamp);
        }


    }
    catch (e) {
        /*This just catches invalid pages.*/
        Helpers.log("PAGE " + page + " IS INVALID");
        THREAD_HALTED[id] = true;

        console.log(e);
    }

    THREAD_HALTED[id] = true;

}




let AuctionHouse = function () {
    this.pagesPopulated = 0;
    this.target = 1000;
    this.lastUpdated = 0;


    this.tradeMap = new Map()
    this.binMap;

    this.populate = async (page) => {
        this.target = Math.min(this.target, page.totalPages);
        this.lastUpdated = Math.max(this.lastUpdated, page.lastUpdated);
        for (let auction in page.auctions) {
            let name = Helpers.getName(page.auctions[auction]) + " (" + Helpers.niceCapitalize(page.auctions[auction].tier) + ")";
            if (page.auctions[auction].bin && !page.auctions[auction].item_name[0].includes("[") && !page.auctions[auction].item_name.includes(" Skin")) {
                if (this.tradeMap.has(name)) {
                    this.tradeMap.get(name).addAuction(page.auctions[auction]);
                }
                else {
                    this.tradeMap.set(name, new AuctionItem(name, page.auctions[auction]));
                }
			}
        }
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        module.exports.AH_PAGES_DONE = this.pagesPopulated + 1;
        module.exports.AH_PAGES_NEEDED = this.target;
        process.stdout.write("Progress: " + (this.pagesPopulated + 1) + "/" + this.target);
        this.pagesPopulated++;
    }

    this.earlyScan = (page) => { 

        let early_auctions = [];

        for (let auction in page.auctions) {
            let name = Helpers.getName(page.auctions[auction]) + " (" + Helpers.niceCapitalize(page.auctions[auction].tier) + ")";
            if (page.auctions[auction].bin && !page.auctions[auction].item_name[0].includes("[") && !page.auctions[auction].item_name.includes(" Skin") && this.tradeMap.has(name)) {
                let persistent_data = this.tradeMap.get(name);

                if (persistent_data.checkTrade(page.auctions[auction])) {
                    early_auctions.push(page.auctions[auction]);
                }
			}
        }

        return early_auctions;

    }

    this.earlyScanAuction = (auction) => { 

        let name = Helpers.getName(auction) + " (" + Helpers.niceCapitalize(auction.tier) + ")";

        console.log(name)
        console.log(auction.bin)
        console.log(auction.item_name)

        if (auction.bin && !auction.item_name[0].includes("[") && !auction.item_name.includes(" Skin") && this.tradeMap.has(name)) {
            let persistent_data = this.tradeMap.get(name);

            console.log(auction.starting_bid)
            console.log(persistent_data.prices[1])
            console.log(persistent_data.zscore(auction))
        }

    }

    this.prune = () => {
        let binKillList = [];
        let tradeKillList = [];

        this.binMap = new Map(this.tradeMap);

        this.binMap.forEach((itemdata, key) => {
            if (itemdata.prices.length < 20 || !itemdata.checkTrade(itemdata.flip)) {
                binKillList.push(key);
            }
        });

        this.tradeMap.forEach((itemdata, key) => {
            if (itemdata.prices.length < 20) {
                tradeKillList.push(key);
            }
        });

        binKillList.forEach((a) => {
            this.binMap.delete(a);
        });
        
        tradeKillList.forEach((a) => {
            this.tradeMap.delete(a);
        });
	}

    this.filled = () => { return this.pagesPopulated >= this.target - 1; }
}

let AuctionItem = function (tag, firstAuction) {
    this.name = tag;
    this.flip = firstAuction;

    this.prices = [firstAuction.starting_bid];

    this.addAuction = (auction) => {
        if (auction.starting_bid < this.flip.starting_bid) {
            this.flip = auction;
        }
        this.prices.push(auction.starting_bid);

        this.prices.sort((a, b) => { return a - b; });
    }

    this.getAverage = () => {
        if (this.prices.length < 7) {
            return 10000000000;
        }

        let avg = 0;
        for (let i = 1; i < 7; i++) {
            avg += this.prices[i];
        }
        return avg / 6;
    }

    this.std = () => {
        return std(this.prices.slice(1, 7));
    }

    this.profit = () => {
        return this.prices[1] * 0.98 - this.prices[0];
    }

    this.zscore = (trade) => {
        let std = this.std();
        if(!std) {
            return this.prices[1]*this.prices[1]/(trade.starting_bid * trade.starting_bid);
        }

        return (this.prices[1] - trade.starting_bid) / this.std();
    }

    this.price = () => {
        return this.flip.starting_bid;
	}

    this.checkTrade = (trade) => {
        let zscore = this.zscore(trade);

        //console.log(this.name);
        //console.log("Trade Price: " + trade.starting_bid);
        //console.log("Market Price: " + this.prices[1]);
        //console.log("Z-score: " + zscore);

        return (zscore > 10 && zscore < 1000000)
    }
}

let PriceTracker = function () {
    this.items = new Map();

    this.update = async (ah) => {
        if(this.items.size == 0) {
            ah.tradeMap.forEach((data, tag) => {
                this.items.set(tag, new ItemTracker());
            });
        }

        ah.tradeMap.forEach((data, tag) => {
            if(this.items.has(tag)) {
                this.items.get(tag).appendPrice(data.flip.starting_bid);
            }
        });
    }

    this.search = (search_tag) => {
        let results = [];

        this.items.forEach((data, tag) => {
            if(tag.toLowerCase().includes(search_tag.toLowerCase())){
                results.push(tag);
            }
        });

        return results;
    }


}

let ItemTracker = function () {

    this.minute_prices = [];

    this.appendPrice = (price) => {
        this.minute_prices.push(price);
    }

    this.summarize_hour = () => summarize(this.minute_prices.slice(0, 60));
    this.summarize_day = () => summarize(this.minute_prices.slice(0, 24 * 60));
    this.summarize_week = () => summarize(this.minute_prices.slice(0, 24 * 60 * 7));

}




function summarize (data) {

    let n = data.length;
    let sorted_data = data.sort();

    if(!n) {
        return {valid: false}
    }

    return {
        open: data[0],
        close: data[n - 1],
        mean : data.reduce((a, b) => a + b) / n,
        median: (n % 2) < 1 ? ((sorted_data[n / 2] + sorted_data[n / 2 - 1]) / 2) : (sorted_data[Math.floor(n/2)]),
        min: sorted_data[0],
        max: sorted_data[n - 1],
        std: std(data),

        valid: true
    }

}

function double_summarize (data) {

    let n = data.length;
    let sorted_data = data.map((a) => a.mean).sort();

    if(!n) {
        return {valid: false}
    }

    return {
        open: data[0].open,
        close: data[n - 1].close,
        mean : data.map((a) => a.mean).reduce((a, b) => a + b) / n,
        median: (n % 2) < 1 ? ((sorted_data[n / 2] + sorted_data[n / 2 - 1]) / 2) : (sorted_data[Math.floor(n/2)]),
        min: Math.min(...data.map((a) => a.min)),
        max: Math.max(...data.map((a) => a.max)),
        std: std(sorted_data),

        valid: true
    }

}



function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function std(array) {
    const n = array.length
    const mean = array.reduce((a, b) => a + b) / n
    return Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n)
}
