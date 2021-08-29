const axios = require('axios');
const Helpers = require('./helpers');



module.exports = {
    AH_INITIALIZED: false,

    pullAHData: async (timeStamp) => {
        let time = Date.now();
        let ah = new AuctionHouse();
        let i = 0;

        for (let i = 0; i < 100; i++) {
            getAuctionPageHTTP(ah, i, timeStamp);
        }

        while (!ah.filled() && Date.now() - time < 10000) {
            await sleep(5);
        }

        ah.prune();

        console.log("Time taken: " + (Date.now() - time) / 1000 + " sec")
        console.log("AH DATA TIMESTAMP: " + ah.lastUpdated);
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
        while (response.timeStamp < timeStamp) {
            response = await axios.get('https://api.hypixel.net/skyblock/auctions?page=' + page);
		}
        ah.populate(response.data);
    }
    catch (e) { /*This just catches invalid pages.*/ }

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
            if (page.auctions[auction].bin) {
                if (this.binMap.has(name)) {
                    this.binMap.get(name).addAuction(page.auctions[auction]);
                }
                else {
                    this.binMap.set(name, new AuctionItem(name, page.auctions[auction]));
                }
			}
        }
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
            this.binMap.delete(a);
        });
	}

    this.filled = () => { return this.pagesPopulated >= this.target; }
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
