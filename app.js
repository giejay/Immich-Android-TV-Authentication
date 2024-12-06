const path = require("path");
const ExpiryMap = require('expiry-map');
const http = require('http');
const express = require('express');
const app = require('@root/async-router').Router();

const publicDir = path.join(__dirname, './public')

app.use(express.static(publicDir))
app.use(express.urlencoded({extended: 'false'}))
app.use(express.json())

const deviceCodes = new ExpiryMap(180000, []);

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

app.post("/username", async (req, res) => {
    const {code, email, password, host} = req.body;
    if (!deviceCodes.get(code)) {
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
        let loginResponse;
        try {
            loginResponse = await (await fetch(url, {
                method: 'POST',
                body: body,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            })).json();
        } catch (e) {
            console.error(e);
            res.render("login-username", {
                message: "Invalid hostname!",
                email, password, host, code
            });
            return;
        }
        if (loginResponse.accessToken) {
            let apiKeyResponse;
            try {
                apiKeyResponse = await (await fetch(`${host}/api/api-keys`, {
                    method: 'POST',
                    body: JSON.stringify({
                        name: 'ImmichAndroidTV',
                        permissions: ["album.read", "activity.read", "asset.read", "asset.view", "asset.download", "album.read",
                            "album.download", "archive.read", "face.read", "library.read", "timeline.read", "memory.read", "partner.read",
                            "person.read", "session.read", "tag.read", "tag.asset"]
                    }),
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Cookie': `immich_access_token=${loginResponse.accessToken}`
                    }
                })).json();
            } catch (e) {
                console.error(e);
                res.render("login-username", {
                    message: "Error occurred while creating API key, please contact developer.",
                    email, password, host, code
                });
                return;
            }

            deviceCodes.set(code, {apiKey: apiKeyResponse.secret, host});
            res.render("login-username", {
                message: `Success! Created API key with name: ${apiKeyResponse.apiKey.name} and will use that in the TV app.`,
                host, email, password, code
            })
        } else {
            res.render("login-username", {
                message: "Invalid username/password!",
                host, email, password, code
            });
        }
    }
})

app.post("/register-device", (req, res) => {
    checkAuth(req, res, (res) => {
        res.send({code: getDeviceCode()})
    })
});

app.post('/', (req, res) => {
    const {code, apiKey, host} = req.body;
    if (!deviceCodes.get(code)) {
        res.render("login", {
            message: "Invalid code!",
            apiKey, host
        });
    } else {
        deviceCodes.set(code, {apiKey, host});
        res.render("login", {
            message: "Registered your device!",
            apiKey, host
        });
    }
});

app.get("/config/:deviceCode", (req, res) => {
    const deviceCode = req.params.deviceCode;
    checkAuth(req, res, (res) => {
        const configuration = deviceCodes.get(deviceCode);
        if (!configuration) {
            res.send({
                status: 'NOT_FOUND'
            })
        } else if (!Object.keys(configuration).length) {
            res.send({
                status: 'NO_CONFIG'
            })
        } else {
            deviceCodes.delete(deviceCode);
            res.send({
                status: 'SUCCESS',
                configuration
            })
        }
    })
});

function getDeviceCode() {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    if (!deviceCodes.get(code)) {
        deviceCodes.set(code, {});
        return code
    } else {
        return getDeviceCode();
    }
}

function checkAuth(req, res, callback) {
    if (process.env.API_KEY !== req.get('x-api-key')) {
        res.send(403, 'Invalid API Key')
    } else {
        callback(res)
    }
}

// Start node.js express server
const server = express().use('/', app).set('view engine', 'hbs');
http.createServer(server).listen(5001, function () {
    console.info('Listening on', this.address());
});
