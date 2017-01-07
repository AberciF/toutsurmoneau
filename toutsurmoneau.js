"use strict";
/*global: require*/
// The MIT License (MIT)
//
// Copyright (c) 2017 Etienne Rossignon
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
var assert = require("assert");
var https = require('https');
var http = require('http');
var url = require("url");
var _ = require("lodash");
var Chart = require('cli-chart');
require("colors");
var path = require('path');
var fs = require("fs");
var async = require("async");
var querystring = require('querystring');

var urlStr = "https://www.toutsurmoneau.fr";
var user_agent = "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.87 Safari/537.36";

var doDebug = !!process.env.DEBUG;
function build_request_options(server, path_string) {

    var p = url.parse(urlStr);

    var options = {
        host: p.hostname,
        path: url.resolve(p.pathname, path_string),
        method: 'GET',
        user_agent: user_agent,
        headers: {
            'Accept': "application/json",
            'Accept-Encoding': 'ascii' //'gzip, deflate, sdch, br'
        }
    };
    var cookie = server.cookie.split(" ")[0];
    options.headers["Cookie"] = cookie;
		//+ " TSMEStickyLB=WEB-2P; aelConnection=1; cb-enabled=accepted" ;

    return options;
}

function perform_http_get_transaction(server, command, callback) {
    assert(server instanceof Object);
    assert(server.cookie, "expecting a valid api_key or a valid cookie");
    assert(_.isFunction(callback));
    assert(server.http_protocol);
    if (command.substr(0, 1) === "/") {
        command = command.substr(1);
    }
    var options = build_request_options(server, command);
    var txt = "";

    var req = server.http_protocol.request(options, function(res) {

        res.on('data', function(d) {
            txt += d;
        }).on('error', function(err) {
            // callback(err);
        }).on('end', function() {
            console.warn(" Status Code  = ", res.statusCode);
            if (res.statusCode != 200) {
                console.log("options =", options);
                //xx console.log(" text = ", txt);
								console.log("ERROR ----------------------------------------------".bgWhite.red);
		            callback(new Error("Transaction returned status code " + res.statusCode));
            } else {
                callback(null, JSON.parse(txt));
            }
        });
    });
    req.on('error', function(err) {
        console.log('problem with request: '.red + err.message);
        callback(err);
    });
    req.end();
};

var url = require("url");

function _getCookie(urlStr, username, password, next) {

    assert(_.isFunction(next));

    var post_data = querystring.stringify({
        input_mail: username,
        input_password: password
    });

    var p = url.parse(urlStr);

    var http_protocol;
    if (p.protocol === "https:") {
        http_protocol = https;
    } else {
        http_protocol = http;
    }

    var options = {
        host: p.hostname,
        path: url.resolve(p.pathname, "/mon-compte-en-ligne/connexion/validation"),
        method: "POST",
        user_agent: user_agent,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(post_data)
        }
    };

    var req = http_protocol.request(options, function(res) {

        if (doDebug) {
					console.log('STATUS: ' + res.statusCode);
          // console.log('HEADERS: ' + JSON.stringify(res.headers,null," "));
				}
        res.setEncoding('utf8');

        var data = "";
        res.on('data', function(chunk) {
            data += chunk
        });
        res.on('end', function() {

					  if(res.statusCode != 200 && res.statusCode != 302){
							console.log("Username and Password Invalid !".bgWhite.red.bold);
							var err = new Error("Invalid crendential");
							return next(err);
						}
            if (doDebug) {
							console.log("Headers !=",res.headers);
            	console.log(" Data =",data.length);
            }
						var selected_elements = res.headers["set-cookie"].filter(function(str) {
                //  1234567890123456
                return str.match(/eZSESSID/);
            });

            assert(selected_elements.length === 1);
            var _cookie_session = selected_elements[0].split(";")[0];
            next(null, _cookie_session);
        });
    });
    req.on('error', function(err) {
        console.log('problem with request: '.red + err.message);
        next(err);
    });
    // write data to request body
    req.write(post_data);
    //req.write("input_mail=" + username + "&input_password=" + password  + "\n");
    req.end();
}

function toutsurmoneau(username, password, next) {

    var now = new Date();

    var server = {
        pathname: "",
        host: "www.toutsurmoneau.fr",
        port: 443,
        cookie: "",
        http_protocol: https,
    };

    var results = [];

    function w(v, n, p) {
        return v;
        var padding = new Array(n).join(p);
        return (padding + v.toString()).substr(0, n);
    }

    function statistics(callback) {

        var min = 12;
        var date_min;
        var max = 0;
        var date_max;
        var today = new Date(new Date() - 1000 * 3600 * 24);
        var todayStr = "" + w(today.getDate(), 2, "0") + "/" + (today.getMonth() + 1) + "/" + today.getFullYear();

        results.forEach(function(d) {
            if (d[1] != 0) {
                if (d[1] < min) {
                    min = d[1];
                    date_min = d[0];
                }
                if (d[1] > max) {
                    max = d[1];
                    date_max = d[0];
                }
            }
            if (d[0] == todayStr) {
                console.log(" Consommation today =", todayStr, d[1]);
            }
        });

        console.log("    Minimum   = ", min, date_min);
        console.log("    Maxmimum  = ", max, date_max);
        callback();
    }

    function draw(callback) {
        var chart = new Chart({
            xlabel: 'jours',
            ylabel: 'm^3',
            direction: 'y',
            width: 31 * 3,
            height: 30,
            lmargin: 5,
            step: 1
        });
        results.forEach(function(d) {
            if (d[1] > 0.6) {
                chart.addBar(d[1], "red");
            } else if (d[1] < 0.100) {
                chart.addBar(0.1, "green");
            } else {
                chart.addBar(d[1]);
            }
        })
        chart.draw();
        callback();
    }

    function dump_month(date, callback) {
        var year = date.getFullYear();
        var month = date.getMonth() + 1;
        var cmd = "/mon-compte-en-ligne/statJData/" + year + "/" + month;
        // post request for
        perform_http_get_transaction(server, cmd, function(err, data) {
            if (!err) {
							results = results.concat(data);
            } else {
						}
						callback(err);
        });
    }
    async.series([
        function(callback) {
            _getCookie(urlStr, username, password, function(err, cookie) {
                if (err) return callback(err);
                server.cookie = cookie;
                callback();
            })
        },
        function(callback) {
            var date = new Date(now - 1000 * 3600 * 24 * 61);
            dump_month(date, callback);
        },
        function(callback) {
            var date = new Date(now - 1000 * 3600 * 24 * 30);
            dump_month(date, callback);
        },
        function(callback) {
            dump_month(now, callback);
        },
        draw,
        statistics,
    ], next);
}

var config = null;

function getConfig(callback) {
    try {
        config = require("./config.js");
    } catch (e) {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        config = {};
        rl.question('enter your email address: ', (answer) => {
            config.username = answer;
            rl.question('enter your password: ', (answer) => {
                config.password = answer;

                fs.writeFile("./config.js",
                    `module.exports = { username: "${config.username}",password: "${config.password}" };`,
                    function() {

                    });
                rl.close();
                callback(null, config);
            });
        });
        return;
    }
    callback(null, config);
}

getConfig(function(err, config) {
    if (!err) {
        toutsurmoneau(config.username, config.password, function(err, cookie) {
            console.log("done...");
        });
    }
});
