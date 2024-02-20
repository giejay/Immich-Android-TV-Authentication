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

app.post("/username", (req, res) => {
    const {code, email, password, host} = req.body;
    if (!deviceCodes[code]) {
        res.render("login-username", {
            message: "Invalid code!",
            email, password, host
        });
    } else {
        const url = `${host}/api/auth/login`;
        const body = JSON.stringify({
            email,
            password
        });
        fetch(url, {
            method: 'POST',
            body: body,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        }).then(response => {
            response.json().then(json => {
                if (json.accessToken) {
                    fetch(`${host}/api/api-key`, {
                        method: 'POST',
                        body: JSON.stringify({name: 'ImmichAndroidTV'}),
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'Cookie': `immich_access_token=${json.accessToken}`
                        }
                    }).then(apiKeyResponse => {
                        apiKeyResponse.json().then(apiKey => {
                            deviceCodes[code] = {apiKey: apiKey.secret, host}
                            res.render("login-username", {
                                message: `Success! Created API key with name: ${apiKey.apiKey.name} and will use that in the TV app.`,
                                host, email, password
                            })
                        })
                    })
                } else {
                    res.render("login-username", {
                        message: "Invalid username/password!",
                        host, email, password
                    });
                }
            });
        });
    }
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
            message: "Invalid code!",
            apiKey, host
        });
    } else {
        deviceCodes[code] = {apiKey, host}
        res.render("login", {
            message: "Registered your device!",
            apiKey, host
        });
    }
});

app.get("/config/:deviceCode", (req, res) => {
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
