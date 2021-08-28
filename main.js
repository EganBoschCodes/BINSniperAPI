const express = require('express');
const Helpers = require('./helpers');
const Backend = require('./data-analysis');

const app = express();
const port = 3000;


app.get('/whitelist/username=*', async (req, res) => {
    console.log(req.originalUrl)
    let name = req.originalUrl.split("=")[1]

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
    if (Helpers.isWhitelisted(username)) {

        Backend.timeAHPull();



    }

    else {
        response = {
            status: 400,
            error: "Username not whitelisted!"
        }
    }

    res.json(response)

});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));