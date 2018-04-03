var cfg = require("./config.json")

var nodeUtil = require('util');
var fmt = nodeUtil.format;

var redis = require("redis");
var Promise = require("bluebird");

var express = require('express');
var bodyParser = require('body-parser');

Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);

// redis connection init
var redisClient = redis.createClient(cfg.redis);
// if you'd like to select database 3, instead of 0 (default), call
// redisClient.select(3, function() { /* ... */ });

redisClient.on('connect', function() {
  console.log('Connected to redis, with config:', cfg.redis)
});

redisClient.on("error", function (err) {
    console.log("Error " + err);
});

function saveBody(k, req) {
    redisClient.set(k, JSON.stringify(req.body), redis.print);
}


// express init
var app = express()
app.use(bodyParser.json());

app.get('/', function (req, res) {
    console.log("Recieved GET on '/'");
    console.log(req.query);
    redisClient.getAsync('foo').then(function(redisResult) {
        res.send('<h1>Hello, this is backend for AgileBoard project</h1></br><h3>See <a href="https://github.com/lkmfwe/AgileBoardFrontend">https://github.com/lkmfwe/AgileBoardFrontend</a> for more details</h3>');
    });
});


app.get('/GetProjects', function (req, res) {  // no params
    console.log("Recieved GET on '/GetProjects'");
    RedisClient.getAsync('Projects').then(res.send)
});

app.get('/GetColumnsByProject', function (req, res) { // params: projectId
    console.log("Recieved GET on '/GetColumnsByProject'");
    console.log(req.query);

});

app.get('/GetTicketsByColumn', function (req, res) { // params: columnId
    console.log("Recieved GET on '/GetTicketsByColumn'");
    console.log(req.query);

});

app.post('/SetColumnName', function (req, res) { // params: columnId, columnName
    console.log("Recieved GET on '/SetColumnName'");
    console.log(req.query);

});

app.post('/SetProjectName', function (req, res) { //params: projectId, projectName
    console.log("Recieved GET on '/SetProjectName'");
    console.log(req.query);

});

app.post('/MoveTicketToColumn', function (req, res) { // params: fromColumnId, toColumnId, ticketId, index
    console.log("Recieved GET on '/MoveTicketToColumn'");
    console.log(req.query);
});

app.post('/AddNewColumn', function (req, res) { // params: projectId
    console.log("Recieved GET on '/AddNewColumn'");
    console.log(req.query);
});

app.post('/AddNewProject', function (req, res) { // no params
    console.log("Recieved GET on '/AddNewProject'");
    console.log(req.query);
});

app.listen(cfg.port, function() {
    console.log(fmt("AgileBoard Backend is listening on port %s", cfg.port));
});
