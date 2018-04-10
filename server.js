const cfg = require("./config.json")

const nodeUtil = require('util');
const fmt = nodeUtil.format;
const redis = require("redis");

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const PROJECT_NAME_PREFIX = "Project";
const COLUMN_NAME_PREFIX = "Column";

// redis connection init
const redisClient = redis.createClient(cfg.redis);
// if you'd like to select database 3, instead of 0 (default), call
// redisClient.select(6, function() { /* ... */ });

redisClient.on('connect', function() {
  console.log('Connected to redis, with config:', cfg.redis)
});

redisClient.on("error", function (err) {
    console.log("Error " + err);
});

function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
                   .toString(16)
                   .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
           s4() + '-' + s4() + s4() + s4();
}

function findLargestNumUsed(items, fieldName, prefix) {
    /*
    Returns largest postfix number in array of objects, where each object contains
    key `fieldName`, and `fieldName` should start with given prefix
    */
    var largestProjectNumUsed = 0;
    for (var i = 0; i < items.length; ++i) {
        if (items[i][fieldName].startsWith(prefix)) {
            var num = parseInt(items[i][fieldName].slice(prefix.length));
            if (!isNaN(num) && (num > largestProjectNumUsed)) {
                largestProjectNumUsed = num;
            }
        }
    }
    return largestProjectNumUsed;
}



// express init
var app = express();
app.use(cors());
app.use(bodyParser.json());

app.get('/', function (req, res) {
    /*
    Stub web hook for handling unexpected calls
    */
    console.log("Recieved GET on '/'");
    console.log(req.query);
    redisClient.get('foo', function(err, redisResult) {
        if (err) {
            console.error(err);
        }
        res.send('<h1>Hello, this is backend for AgileBoard project</h1></br><h3>See <a href="https://github.com/lkmfwe/AgileBoardFrontend">https://github.com/lkmfwe/AgileBoardFrontend</a> for more details</h3>');
    });
});



// Actual api request handling

// tested
app.get('/GetProjects', function (req, res) {  // no params
    /*
    GET GetProjects :: Project[]

    Returns project list.
    */
    console.log("Recieved GET on '/GetProjects'");
    redisClient.hvals('Projects', function (err, projects) {
        if (err) {
            console.log(err);
        }
        if (projects != null) {
            for (var i = 0; i < projects.length; ++i) {
                projects[i] = JSON.parse(projects[i]);
            }
            res.send(projects)
        }
        else {
            console.log("Projects is null");
            res.send("[]")
        }
    });
});

// tested
app.get('/GetColumnsByProject', function (req, res) { // params: projectId
    /*
    GET GetColumnsByProject :: projectId:string -> Column[]
    `/GetColumnsByProject?projectId=<projectId>`

    Returns list of columns in project
    */
    console.log("Recieved GET on '/GetColumnsByProject'");
    console.log(req.query);
    if (typeof req.query.projectId !== "undefined") {
        redisClient.hget("Project-columns", req.query.projectId, function (err, projectColIds) {
            if (err) {
                console.error(err);
                res.send([]);
            }
            else if (projectColIds) {
                projectColIds = JSON.parse(projectColIds);
                function requestColumn(i, acc) {
                    if (i < projectColIds.length) {
                        redisClient.hget("Columns", projectColIds[i], function (err, column) {
                            if (err) {
                                console.error(err);
                            }
                            else if (column) {
                                column = JSON.parse(column);
                                acc.push(column);
                            }
                            requestColumn(i + 1, acc);
                        });
                    }
                    else {
                        res.send(acc);
                    }
                }
                requestColumn(0, []);
            }
            else {
                res.send([]);
            }
        });
    }
    else {
        res.send([]);
    }
});

// tested
app.get('/GetTicketsByColumn', function (req, res) { // params: columnId
    /*
    GET GetTicketsByColumn :: columnId:string -> Ticket[]
    `/GetTicketsByColumn?columnId=<columnId>`

    Return list of tickets in column
    */
    console.log("Recieved GET on '/GetTicketsByColumn'");
    console.log(req.query);
    if (typeof req.query.columnId !== 'undefined') {
        redisClient.hget("Column-tickets", req.query.columnId, function (err, ticketIds) {
            if (err) {
                console.error(err);
                res.send([]);
            } else if (ticketIds) {
                ticketIds = JSON.parse(ticketIds);

                function requestTicket(i, acc) {
                    if (i < ticketIds.length) {
                        redisClient.hget("Tickets", ticketIds[i], function (err, ticket) {
                            if (err) {
                                console.error(err);
                            }
                            else if (ticket) {
                                ticket = JSON.parse(ticket);
                                acc.push(ticket);
                            }
                            requestTicket(i + 1, acc)
                        });
                    }
                    else {
                        res.send(acc);
                    }
                }
                requestTicket(0, []);
            }
            else {
                res.send([]);
            }
        });
    }
    else {
        res.send([]);
    }
});

//tested
app.post('/SetColumnName', function (req, res) { // params: columnId, columnName
    /*
    POST SetColumnName :: columnId:string -> columnName:string -> bool
    `/SetColumnName?columnId=<columnId>&columnName=<columnName>`

    Sets column name. Returns true if save is successful, false otherwise.
    */
    console.log("Recieved POST on '/SetColumnName'");
    console.log(req.query);
    if (typeof req.query.columnId !== 'undefined' && typeof req.query.columnName !== 'undefined') {
        redisClient.hget("Columns", req.query.columnId, function (err, column) {
            if (err) {
                console.error(err);
                res.send("false");
            }
            else if (column) {
                var col = {
                    "ColumnId": req.query.columnId,
                    "ColumnName": req.query.columnName
                };
                redisClient.hset("Columns", col.ColumnId, JSON.stringify(col), function () {
                    res.send('true');
                })
            }
            else {
                res.send("false");
            }
        })
    }
    else {
        res.send("false");
    }

});

// tested
app.post('/SetProjectName', function (req, res) { //params: projectId, projectName
    /*
    POST SetProjectName :: projectId:string -> projectName:string -> bool
    `/SetProjectName?projectId=<projectId>&projectName=<projectName>`

    Sets project name. Returns true if save is successful, false otherwise.
    */
    console.log("Recieved POST on '/SetProjectName'");
    console.log(req.query);
    if (typeof req.query.projectId !== "undefined" && typeof req.query.projectName !== "undefined") {
        var proj = {
            "ProjectId": req.query.projectId,
            "ProjectName": req.query.projectName
        };
        redisClient.hget("Projects", req.query.projectId, function (err, project) {
            if (err) {
                console.error(err);
                res.send("false");
            } else if (project) {
                redisClient.hset("Projects", req.query.projectId, JSON.stringify(proj), function (err) {
                    if (err) {
                        console.error(err);
                        res.send("false")
                    }
                    else {
                        res.send("true");
                    }
                });
            }
            else {
                res.send("false");
            }
        });
    }
    else {
        res.send("false");
    }
});

// tested
app.post('/MoveTicketToColumn', function (req, res) { // params: fromColumnId, toColumnId, ticketId, index
    /*
    POST MoveTicketToColumn :: fromColumnId:string -> toColumnId:string -> ticketId:string -> index:int -> bool
    /MoveTicketToColumn?fromColumnId=<...>&toColumnId=<...>&ticketId=<...>&index=<...>`

    Moves ticket to specified column and places it in specified index. Indices are zero-based.
    */
    console.log("Recieved POST on '/MoveTicketToColumn'");
    console.log(req.query);
    if (typeof req.query.fromColumnId !== 'undefined'
     && typeof req.query.toColumnId !== 'undefined'
     && typeof req.query.ticketId != 'undefined'
     && typeof req.query.index != 'undefined')
    {
        redisClient.hget("Tickets", req.query.ticketId, function (err, ticket) {
            if (err) {
                console.error(err);
                res.send("false");
            }
            else if (ticket) {
                redisClient.hget("Column-tickets", req.query.fromColumnId, function (err, srcColTicketIds) {
                    if (err) {
                        console.error(err);
                        res.send("false");
                    }
                    else if (srcColTicketIds) {
                        srcColTicketIds = JSON.parse(srcColTicketIds);
                        filteredSrcColTicketIds = srcColTicketIds.filter(function (id) { return id !== req.query.ticketId; });
                        if (srcColTicketIds.length > filteredSrcColTicketIds.length) {
                            redisClient.hget("Columns", req.query.toColumnId, function (err, destColumn) {
                                if (err) {
                                    console.error(err);
                                    res.send("false");
                                }
                                else if (destColumn) {
                                    redisClient.hget("Column-tickets", req.query.toColumnId, function (err, destColTicketIds){
                                        if (err) {
                                            console.error(err);
                                            destColTicketIds = [];
                                        }
                                        else if (destColTicketIds) {
                                            destColTicketIds = JSON.parse(destColTicketIds);
                                        }
                                        else {
                                            destColTicketIds = [];
                                        }
                                        destColTicketIds = destColTicketIds.filter(function (id) { return id !== req.query.ticketId; });
                                        destColTicketIds.splice(req.query.index, 0, req.query.ticketId);

                                        redisClient.hset("Column-tickets", req.query.fromColumnId, JSON.stringify(filteredSrcColTicketIds), function () {
                                            redisClient.hset("Column-tickets", req.query.toColumnId, JSON.stringify(destColTicketIds), function () {
                                                res.send("true");
                                            });
                                        });
                                    });
                                }
                                else {
                                    res.send("false");
                                }
                            });
                        }
                        else {
                            res.send("false");
                        }
                    }
                    else {
                        res.send("false");
                    }
                });
            }
            else {
                res.send("false");
            }
        });
    }
    else {
        res.send("false");
    }
});

//tested
app.post('/AddNewColumn', function (req, res) { // params: projectId
    /*
    POST AddNewColumn :: projectId:string -> Column
    `/AddNewColumn?projectId=<...>`

    Creates new column in specified project with default name and returns it.
    */
    console.log("Recieved POST on '/AddNewColumn'");
    console.log(req.query);
    if (typeof req.query.projectId !== "undefined") {
        redisClient.hget("Projects", req.query.projectId, function (err, proj) {
            if (err) {
                console.error(err);
                res.send("null");
            }
            else  if (proj) {
                redisClient.hget("Project-columns", req.query.projectId, function (err, columns) {
                    if (err) {
                        console.error(err);
                        var column = {
                            ColumnId: guid(),
                            ColumnName: COLUMN_NAME_PREFIX +  "1"
                        };
                        redisClient.hset("Columns", column.ColumnId, JSON.stringify(column), function() {
                            redisClient.hset("Project-columns", req.query.projectId, JSON.stringify([column.ColumnId]), function () {
                                res.send(column);
                            })
                        });
                    }
                    else if (columns) {
                        columns = JSON.parse(columns);
                        console.log("Pulled column ids:");
                        console.log(JSON.stringify(columns));
                        redisClient.hvals("Columns", function (err, columnObjs) {
                            for (var i = 0; i < columnObjs.length; ++i) {
                                columnObjs[i] = JSON.parse(columnObjs[i]);
                            }

                            columnObjs = columnObjs.filter(function (col) {
                                return columns.includes(col.ColumnId);
                            });
                            console.log(JSON.stringify(columnObjs));
                            var column = {
                                ColumnId: guid(),
                                ColumnName: COLUMN_NAME_PREFIX + (findLargestNumUsed(columnObjs, "ColumnName", COLUMN_NAME_PREFIX) + 1).toString()
                            };
                            columns.push(column.ColumnId);
                            redisClient.hset("Columns", column.ColumnId, JSON.stringify(column), function() {
                                redisClient.hset("Project-columns", req.query.projectId, JSON.stringify(columns), function () {
                                    res.send(column);
                                });
                            });
                        });
                    }
                    else {
                        console.log("Project columns are missing, creating new one");
                        var column = {
                            ColumnId: guid(),
                            ColumnName: COLUMN_NAME_PREFIX +  "1"
                        };
                        redisClient.hset("Columns", column.ColumnId, JSON.stringify(column), function() {
                            redisClient.hset("Project-columns", req.query.projectId, JSON.stringify([column.ColumnId]), function () {
                                res.send(column);
                            });
                        });
                    }
                });
            }
            else {
                res.send("null");
            }
        });
    }
    else {
        res.send("null");
    }
});

// tested
app.post('/AddNewProject', function (req, res) { // no params
    /*
    POST AddNewProject :: Project
    `/AddNewPoject`

    Creates new project with default project name and returns it.
    */
    console.log("Recieved POST on '/AddNewProject'");
    redisClient.hvals('Projects', function (err, projects) {
        if (projects) {
            console.log("Received projects");
            console.log(projects);

            for (var i = 0; i < projects.length; ++i) {
                projects[i] = JSON.parse(projects[i]);
            }

            var proj = {
                "ProjectId": guid(),
                "ProjectName" : PROJECT_NAME_PREFIX + (findLargestNumUsed(projects, "ProjectName", PROJECT_NAME_PREFIX) + 1).toString()
            };

            redisClient.hset('Projects', proj.ProjectId, JSON.stringify(proj), function () {
                res.send(proj);
            });
        }
        else {
            var proj = {
                "ProjectId": guid(),
                "ProjectName" : PROJECT_NAME_PREFIX + "1"
            };
            redisClient.hset('Projects', proj.ProjectId, JSON.stringify(proj), function () {
                res.send(proj);
            });
        }
    });
});

//tested
app.post("/SaveUser", function(req, res) {
    /*
    POST SaveUser :: User (POST body) -> User
    /SaveUser

    Saves new user in system.
    Returns null if there is already user with such UserId
    */
    console.log("Recieved POST on '/SaveUser'");
    console.log(req.body);

    if (typeof req.body.UserId !== 'undefined' && typeof req.body.FirstName !== 'undefined' && typeof req.body.LastName !== 'undefined') {
        // UserId: string
        // FirstName: string
        // LastName: string
        // UserPic: string (url) - unnecessary

        redisClient.hget("Users", req.body.UserId, function(err, user) {
            if (err) {
                console.error(err);
                res.send("null");
            }
            else if (user) {
                res.send("null");
            }
            else {
                redisClient.hset("Users", req.body.UserId, JSON.stringify(req.body), function () {
                    res.send(req.body);
                });
            }
        });
    }
});

//tested
app.get('/LoadAllUsers', function(req, res) { // no params
    /*
    GET LoadAllUsers :: User[]
    `/LoadAllUsers`

    Returns all users in system.
    */
    console.log("Recieved GET on '/LoadAllUsers'");
    redisClient.hvals("Users", function (err, users) {
        if (err) {
            console.error(err);
            res.send([]);
        }
        else if (users){
            for (var i = 0; i < users.length; ++i) {
                users[i] = JSON.parse(users[i]);
            }
            res.send(users);
        }
        else {
            res.send([]);
        }
    });
});

//tested
app.get('/LoadCurrentUser', function(req, res) { // no params
    /*
    GET LoadCurrentUser :: User
    `/LoadCurrentUser`

    Returns current user.
    Returns null if there is no users
    */
    console.log("Recieved GET on '/LoadCurrentUser'");
    redisClient.hvals("Users", function (err, users) {
        if (err) {
            console.error(err);
            res.send("null");
        }
        else if (users) {
            if (users.length > 0) {
                res.send(JSON.parse(users[0]));
            }
            else {
                res.send("null");
            }
        }
        else {
            res.send("null");
        }
    })
});

//tested
app.post('/SaveTicket', function(req, res) {
    /*
    POST SaveTicket :: Ticket (POST body) -> Ticket
    `/SaveTicket`

    Saves ticket and returns saved ticked.
    If save is successful returns true, false otherwise
    */
    console.log("Recieved POST on '/SaveTicket'");
    console.log(req.body);
    redisClient.hget("Tickets", req.body.TicketId, function (err, ticket) {
        if (err) {
            console.error(err);
            res.send("false");
        }
        else if (ticket) {
            redisClient.hset("Tickets", req.body.TicketId, JSON.stringify(req.body), function (err) {
                if (err) {
                    console.error(err);
                    res.send("false");
                }
                else {
                    res.send("true");
                }
            })
        }
        else {
            res.send("false");
        }
    });
});

// tested
app.post('/AddTicket', function(req, res) {
    /*
    POST AddTicket :: columnId:string -> Ticket
    `/AddTicket?columnId=<...>`

    Creates new ticket in specified column with default values and returns it.
    */
    console.log("Recieved POST on '/AddTicket'");
    console.log(req.query);
    if (typeof req.query.columnId !== "undefined") {
        redisClient.hget("Columns", req.query.columnId, function (err, column) {
            if (err) {
                console.error(err);
                res.send("null");
            }
            else if (column) {
                var ticket = {
                    TicketId: guid(),
                    TicketTitle: "Default ticket title",
                    TicketDescription: "",
                    TicketPic: null,
                    StartDate: Math.round(+new Date()/1),
                    EndDate: Math.round(+new Date()/1) + 604800000,
                    Tags: [],
                    AssigneeId: null,
                    Dependencies: []
                };
                redisClient.hset("Tickets", ticket.TicketId, JSON.stringify(ticket), function () {
                    redisClient.hget("Column-tickets", req.query.columnId, function (err, colTickets) {
                        if (err) {
                            console.error(err);
                            redisClient.hset("Column-tickets", req.query.columnId, JSON.stringify([ticket.TicketId]), function () {
                                res.send(ticket);
                            });
                        }
                        else if (colTickets) {
                            var colTickets = JSON.parse(colTickets);
                            colTickets.push(ticket.TicketId);
                            console.log(JSON.stringify(colTickets));
                            redisClient.hset("Column-tickets", req.query.columnId, JSON.stringify(colTickets), function () {
                                res.send(ticket);
                            });
                        }
                        else {
                            redisClient.hset("Column-tickets", req.query.columnId, JSON.stringify([ticket.TicketId]), function () {
                                res.send(ticket);
                            });
                        }
                    });
                });
            }
            else {
                res.send("null");
            }
        });
    }
    else {
        res.send("null");
    }
});

// tested
app.post('/DeleteTicket', function (req, res) {
    /*
    POST DeleteTicket :: columnId:string -> ticketId:string -> Bool
    `/DeleteTicket?columnId=<...>&ticketId=<...>`

    Deletes the ticket with specified Id.
    */
    console.log("Recieved POST on '/DeleteTicket'");
    console.log(req.query);
    if (typeof req.query.ticketId !== 'undefined' && typeof req.query.columnId !== 'undefined') {
        redisClient.hget("Tickets", req.query.ticketId, function (err, ticket) {
            if (err) {
                console.error(err);
                res.send("false");
            }
            else if (ticket) {
                redisClient.hdel("Tickets", req.query.ticketId, function (err) {
                    if (err) {
                        console.error(err);
                        res.send("false");
                    }
                    else {
                        redisClient.hget("Column-tickets", req.query.columnId, function (err, columnTicketIds) {
                            if (err) {
                                console.error(err);
                                res.send("true"); // ticket already deleted, though links to it still exist
                            }
                            else if (columnTicketIds) {
                                columnTicketIds = JSON.parse(columnTicketIds);
                                filteredColumnTicketIds = columnTicketIds.filter(function (id) { return id != req.query.ticketId; });
                                redisClient.hset("Column-tickets", req.query.columnId, JSON.stringify(filteredColumnTicketIds), function (err) {
                                    if (err) {
                                        console.error(err);
                                    }
                                    res.send("true");
                                });
                            }
                            else {
                                res.send("true"); // ticket already deleted, though links to it still exist
                            }
                        });
                    }
                });
            }
            else {
                res.send("false");
            }
        });
    }
    else {
        res.send("false");
    }
});

//tested
function deleteColumnRecursive(columnId, success, fail) {
    redisClient.hget("Columns", columnId, function (err, column) {
        if (err) {
            console.error(err);
            fail();
        }
        else if (column) {
            redisClient.hdel("Columns", columnId, function (err) {
                if (err) {
                    console.error(err);
                    fail();
                }
                else {
                    redisClient.hget("Column-tickets", columnId, function (err, columnTicketIds) {
                        if (err) {
                            console.error(err);
                            success();
                        }
                        else if (columnTicketIds) {
                            columnTicketIds = JSON.parse(columnTicketIds);
                            function traverseDeleteTickets (i) {
                                if (i < columnTicketIds.length) {
                                    redisClient.hdel("Tickets", columnTicketIds[i], function (err) {
                                        if (err) {
                                            console.error(err);
                                        }
                                        traverseDeleteTickets(i + 1);
                                    });
                                }
                                else {
                                    redisClient.hdel("Column-tickets", columnId, function (err) {
                                        if (err) {
                                            console.error(err);
                                        }
                                        success();
                                    });
                                }
                            }
                            traverseDeleteTickets(0);
                        }
                        else {
                            success();
                        }
                    });
                }
            });
        } else {
            fail();
        }
    });
}

// tested
app.post('/DeleteColumn', function (req, res) {
    /*
    POST DeleteColumn :: projectId:string -> columnId:string -> Bool
    `/DeleteColumn?projectId=<...>&columnId=<...>`

    Deletes the column with specified Id.
    */
    console.log("Recieved POST on '/DeleteColumn'");
    console.log(req.query);
    if (typeof req.query.columnId !== 'undefined' && typeof req.query.projectId !== 'undefined') {
        function deleteProjectColumnLink () {
            redisClient.hget("Project-columns", req.query.projectId, function (err, projectColumnIds) {
                if (err) {
                    console.error(err);
                    res.send("true");
                }
                else if (projectColumnIds) {
                    projectColumnIds = JSON.parse(projectColumnIds);
                    filteredProjectColumnIds = projectColumnIds.filter(function (id) { return id != req.query.columnId; });
                    redisClient.hset("Project-columns", req.query.projectId, JSON.stringify(filteredProjectColumnIds), function (err) {
                        if (err) {
                            console.error(err);
                        }
                        res.send("true");
                    });
                }
                else {
                    res.send("true");
                }
            });
        }
        deleteColumnRecursive(req.query.columnId, deleteProjectColumnLink, function () {
            res.send("false");
        });
    }
    else {
        res.send("false");
    }
});

//tested
app.post('/DeleteProject', function (req, res) {
    /*
    POST DeleteProject :: projectId:string -> Bool
    `/DeleteProject?projectId=<...>`

    Deletes the project with specified Id.
    */
    console.log("Recieved POST on '/DeleteProject'");
    console.log(req.query);
    if (typeof req.query.projectId !== 'undefined') {
        redisClient.hget("Projects", req.query.projectId, function (err, project) {
            if (err) {
                console.error(err);
                res.send("false");
            }
            else if (project) {
                redisClient.hdel("Projects", req.query.projectId, function (err) {
                    if (err) {
                        console.error(err);
                        res.send("false");
                    }
                    else {
                        redisClient.hget("Project-columns", req.query.projectId, function (err, projectColumnIds) {
                            if (err) {
                                console.error(err);
                                res.send("true");
                            }
                            else if (projectColumnIds) {
                                projectColumnIds = JSON.parse(projectColumnIds);
                                function traverseDeleteProjectColumns(i) {
                                    if (i < projectColumnIds.length) {
                                        function continuation() {
                                            traverseDeleteProjectColumns(i + 1);
                                        }
                                        deleteColumnRecursive(projectColumnIds[i], continuation, continuation);
                                    }
                                    else {
                                        redisClient.hdel("Project-columns", req.query.projectId, function (err) {
                                            if (err) {
                                                console.error(err);
                                            }
                                            res.send("true");
                                        });
                                    }
                                 }
                                traverseDeleteProjectColumns(0);
                            }
                            else {
                                res.send("true");
                            }
                        });
                    }
                });
            }
            else {
                res.send("false");
            }

        });
    }
    else {
        res.send("false");
    }
});


//tested
app.post('/DeleteUser', function (req, res) {
    /*
    POST DeleteUser :: userId:string -> Bool
    `/DeleteUser?userId=<...>`

    Deletes user with specified Id.
    */
    console.log("Recieved POST on '/DeleteUser'");
    console.log(req.query);
    if (typeof req.query.userId !== 'undefined') {
        redisClient.hget("Users", req.query.userId, function (err, user) {
            if (err) {
                console.error(err);
                res.send("false");
            }
            else if (user) {
                redisClient.hdel("Users", req.query.userId, function (err) {
                    res.send("true");
                });
            }
            else {
                res.send('false');
            }
        });
    }
    else {
        res.send("false");
    }
});


app.listen(cfg.port, function() {
    console.log(fmt("AgileBoard Backend is listening on port %s", cfg.port));
});
