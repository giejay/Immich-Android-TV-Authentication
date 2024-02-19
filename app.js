const express = require('express');
const path = require("path")

const app = express();

const publicDir = path.join(__dirname, './public')

app.use(express.static(publicDir))
app.use(express.urlencoded({extended: 'false'}))
app.use(express.json())

app.set('view engine', 'hbs')

const deviceCodes = {};

app.get("/", (req, res) => {
    res.render("login", {
        code: req.query.code
    })
})

app.get("/username", (req, res) => {
    res.render("login-username", {
        code: req.query.code
    })
})

app.post("/register-device", (req, res) => {
    checkAuth(req, res, (res) => {
        const code = Math.floor(100000 + Math.random() * 900000);
        deviceCodes[code] = {};
        res.send({code})
    })
});

app.post('/', (req, res) => {
    const {code, apiKey, host} = req.body;
    if (!deviceCodes[code]) {
        res.render("login", {
            message: "Invalid code!"
        });
    } else {
        deviceCodes[code] = {apiKey, host}
        res.render("login", {
            message: "Registered your device!"
        });
    }
});

app.get("/access-token/:deviceCode", (req, res) => {
    checkAuth(req, res, (res) => {
        const configuration = deviceCodes[req.params.deviceCode];
        if (!configuration) {
            res.send({
                status: 'NOT_FOUND'
            })
        } else if (!Object.keys(configuration).length) {
            res.send({
                status: 'NO_CONFIG'
            })
        } else {
            delete deviceCodes[req.params.deviceCode]
            res.send({
                status: 'SUCCESS',
                configuration
            })
        }
    })
});

function checkAuth(req, res, callback) {
    if (process.env.API_KEY !== req.get('x-api-key')) {
        res.send(403, 'Invalid API Key')
    } else {
        callback(res)
    }
}

app.listen(5000, () => {
    console.log("server started on port 5000")
})
