const axios = require('axios');
const Helpers = require('./helpers');



module.exports = {
    timeAHPull: async (page) => {
        let time = Date.now();
        let ah = new AuctionHouse();
        let i = 0;

        for (let i = 0; i < 100; i++) {
            getAuctionPageHTTP(ah, i);
        }

        while (!ah.filled() && Date.now() - time < 10000) {
            await sleep(5);
        }

        console.log("Time taken: " + (Date.now() - time) / 1000 + " sec")
        return ah;
    }

    
}

let getAuctionPageHTTP = async (ah, page) => {

    try {
        let response = await axios.get('https://api.hypixel.net/skyblock/auctions?page=' + page);
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
            let name = Helpers.getName(page.auctions[auction]);
            if (this.binMap.has(name)) {
                this.binMap.get(name).addAuction(page.auctions[auction]);
            }
            else {
                this.binMap.set(name, new AuctionItem(name, page.auctions[auction]));
			}
        }
        this.pagesPopulated++;
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
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}  