const axios = require('axios');
const Helpers = require('./helpers');



module.exports = {
    AH_INITIALIZED: false,
    AH_DELAY: 0,
    AH_PAGES_DONE: 0,
    AH_PAGES_NEEDED: 1000,

    pullAHData: async (timeStamp) => {
        Helpers.log("Starting AH Pull...");
        module.exports.AH_PAGES_DONE = 0;
        module.exports.AH_PAGES_NEEDED = 1000;
        let ah = new AuctionHouse();
        let i = 0;
        Helpers.log("");
        Helpers.log("");
        Helpers.log("");
        Helpers.log("");
        process.stdout.write("Progress: 0/" + ah.target);

        for (let i = 0; i < 100; i++) {
            getAuctionPageHTTP(ah, i, timeStamp);
        }

        while (!ah.filled()) {
            await sleep(5);
        }

        ah.prune();


        module.exports.AH_DELAY = Date.now() - ah.lastUpdated;
        process.stdout.write("\n");

        Helpers.log("Time taken: " + (Date.now() - ah.lastUpdated) / 1000 + " sec")
        Helpers.log("AH DATA TIMESTAMP: " + ah.lastUpdated);
        module.exports.AH_INITIALIZED = true;
        return ah;
    },

    getAPITimeStamp: async () => {
        let page = await axios.get('https://api.hypixel.net/skyblock/auctions_ended');
        return page.data.success ? page.data.lastUpdated : 0;
	}

    
}

let getAuctionPageHTTP = async (ah, page, timeStamp) => {

    try {
        let response = await axios.get('https://api.hypixel.net/skyblock/auctions?page=' + page);
        if (!response.data.success) {
            Helpers.log(response.data);
            Helpers.log("PAGE " + page + " DOESN'T EXIST");
            return;
        }
        let timeStarted = Date.now();
        while (response.data.timeStamp < timeStamp && (Date.now() - timeStarted < 60000)) {
            ah.target = Math.min(ah.target, response.data.totalPages);
            module.exports.AH_PAGES_DONE = ah.pagesPopulated + 1;
            module.exports.AH_PAGES_NEEDED = ah.target;
            response = await axios.get('https://api.hypixel.net/skyblock/auctions?page=' + page);
            if (!response.data.success) {
                Helpers.log(response.data);
                Helpers.log("PAGE " + page + " DOESN'T EXIST");
                return;
            }
        }
        ah.populate(response.data);
    }
    catch (e) {
        /*This just catches invalid pages.*/
        Helpers.log("PAGE "+page+" IS INVALID");
    }

}

let AuctionHouse = function () {
    this.pagesPopulated = 0;
    this.target = 1000;
    this.lastUpdated = 0;

    this.binMap = new Map();

    this.populate = async (page) => {
        this.target = Math.min(this.target, page.totalPages);
        this.lastUpdated = Math.max(this.lastUpdated, page.lastUpdated);
        for (let auction in page.auctions) {
            let name = Helpers.getName(page.auctions[auction]) + " (" + Helpers.niceCapitalize(page.auctions[auction].tier) + ")";
            if (page.auctions[auction].bin && !page.auctions[auction].item_name[0].includes("[") && !page.auctions[auction].item_name.includes(" Skin")) {
                if (this.binMap.has(name)) {
                    this.binMap.get(name).addAuction(page.auctions[auction]);
                }
                else {
                    this.binMap.set(name, new AuctionItem(name, page.auctions[auction]));
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

    this.prune = () => {
        let killList = [];

        this.binMap.forEach((value, key) => {
            if (value.prices.length < 20) {
                killList.push(key);
            }
            else {
                value.prices.sort((a, b) => { return a - b; });
                let zscore = value.zscore();
                if (zscore < 10 || zscore > 1000000) {
                    killList.push(key);
				}
			}
        });

        killList.forEach((a) => {
            //Helpers.log("DELETING: " + a);
            this.binMap.delete(a);
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

    this.zscore = () => {
        return (this.prices[1] - this.prices[0]) / this.std();
    }

    this.price = () => {
        return this.flip.starting_bid;
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
