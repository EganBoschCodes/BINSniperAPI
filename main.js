const express = require('express');
const Helpers = require('./helpers');
const Backend = require('./data-analysis');

const app = express();
const port = 3000;


let AuctionHouseData = Backend.pullAHData(0);


app.get('/whitelist/username=*', async (req, res) => {
    
    let name = Helpers.getArgument(req.originalUrl, "username")

    let response;
    if (!name.length) {
        response = {
            status: 400,
            error: "No username sent!"
        }
    }
    else {
        response = {
            status: 200,
            whitelisted: Helpers.isWhitelisted(name)
        }
    }

    Backend.timeAHPull();

    res.json(response)

});

app.get('/gettrades/minprofit=*&profitscale=*&username=*', async (req, res) => {

    let minProfit = parseFloat(Helpers.getArgument(req.originalUrl, "minprofit"));
    let profitScale = parseFloat(Helpers.getArgument(req.originalUrl, "profitscale"));
    let username = Helpers.getArgument(req.originalUrl, "username");


    console.log(minProfit)
    console.log(profitScale)
    console.log(username)

    let response;
    if (!Helpers.isWhitelisted(username)) {
        response = {
            status: 400,
            error: "Username not whitelisted!"
        }
    }

    else if (!Backend.AH_INITIALIZED) {
        response = {
            status: 503,
            error: "Auction House Data not populated yet, try again in ~10 seconds."
        }
    }

    else {
        let goodTrades = [];

        let localAH = await AuctionHouseData;

        localAH.binMap.forEach((auction, key) => {
            if (auction.profit() > minProfit && auction.profit() > profitScale * Math.sqrt(auction.price())) {
                goodTrades.push({
                    uuid: auction.flip.uuid,
                    price: auction.price(),
                    avg: auction.getAverage(),
                    profit: auction.profit(),
                    name: key
                });
            }
        })

        goodTrades.sort((a, b) => { return b.profit - a.profit; });

        response = {
            status: 200,
            timestamp: localAH.lastUpdated,
            trades: goodTrades
        }
    }

    res.json(response)

});


let firstSelfUpdate = false;
let updateAH = async () => {

    if (Backend.AH_INITIALIZED) {
        console.log("Checking time...");
        let timeStamp = await Backend.getAPITimeStamp();
        let dataTimestamp = (await AuctionHouseData).lastUpdated;
        if (timeStamp > dataTimestamp) {
            console.log("REFRESHING AUCTION HOUSE...")
            setTimeout(updateAH, 59100);
            localCopy = await Backend.pullAHData(timeStamp)
            AuctionHouseData = localCopy
            firstSelfUpdate = true
        }
        else {
            setTimeout(updateAH, firstSelfUpdate ? 500 : 5000);
        }
    }
    else {
        setTimeout(updateAH, 5000);
    }

}

updateAH();

app.listen(port, () => console.log(`Example app listening on port ${port}!`));