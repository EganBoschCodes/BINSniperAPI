const express = require('express');
const Helpers = require('./helpers');
const Backend = require('./data-analysis');

const app = express();
const port = process.env.PORT || 3000;


let AuctionHouseData = Backend.pullAHData(0);

let lastRequestTimestamp = Date.now();


app.get('/whitelist/username=*', async (req, res) => {

    lastRequestTimestamp = Date.now();
    
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

    res.json(response)

});

app.get('/gettrades/minprofit=*&profitscale=*&username=*', async (req, res) => {

    lastRequestTimestamp = Date.now();

    let minProfit = parseFloat(Helpers.getArgument(req.originalUrl, "minprofit"));
    let profitScale = parseFloat(Helpers.getArgument(req.originalUrl, "profitscale"));
    let username = Helpers.getArgument(req.originalUrl, "username");

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

        Helpers.log("Beginning AH wait...")
        let localAH = await AuctionHouseData;
        Helpers.log("Retrieved AH")

        localAH.binMap.forEach((auction, key) => {
            if (auction.profit() > minProfit && auction.profit() > profitScale * Math.sqrt(auction.price())) {
                goodTrades.push({
                    uuid: auction.flip.uuid,
                    price: auction.price(),
                    avg: Math.round(auction.getAverage()),
                    profit: Math.round(auction.profit()),
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

app.get('/status', async (req, res) => {

    lastRequestTimestamp = Date.now();

    res.json({
        delay: Backend.AH_DELAY,
        done: Backend.AH_PAGES_DONE,
        needed: Backend.AH_PAGES_NEEDED,
        log: Helpers.getLog()
    })

});

app.get('/ping/time=*', async (req, res) => {

    lastRequestTimestamp = Date.now();

    let timestamp = parseFloat(Helpers.getArgument(req.originalUrl, "time"));
    res.json({ timeSent: timestamp, timeRecieved: Date.now() })

});


let firstSelfUpdate = false;
let firstChecking = true;

let ALREADY_UPDATING = false;

let updateAH = async () => {

    if (Backend.AH_INITIALIZED && (Date.now() - lastRequestTimestamp) < 300000) {
        if (firstChecking) {
            Helpers.log("Checking time...");
            firstChecking = false;
        }
        let timeStamp = await Backend.getAPITimeStamp();
        let dataTimestamp = (await AuctionHouseData).lastUpdated;
        if (timeStamp > dataTimestamp && !ALREADY_UPDATING) {
            ALREADY_UPDATING = true;
            Helpers.log("REFRESHING AUCTION HOUSE...")
            setTimeout(updateAH, timeStamp + 59000 - Date.now());
            localCopy = await Backend.pullAHData(timeStamp);
            AuctionHouseData = localCopy;
            firstSelfUpdate = true;
            firstChecking = true;
            ALREADY_UPDATING = false;
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

app.listen(port, () => Helpers.log(`Skyblock API listening on port ${port}!`));