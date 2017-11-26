// Setup basic express server
var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
var url = 'mongodb://localhost:27017/chat';
var port = process.env.PORT || 3000;

//Mongo connection
MongoClient.connect(url, function(err, database) {
    if(err) throw err;
    app.locals.db  = database;
});

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(path.join(__dirname, 'public')));

// Chatroom

var numUsers = 0;
var users = [];

io.on('connection', function (socket) {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    // we tell the client to execute 'new message'
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data
    });
    if(data){
      const db = app.locals.db;
      var collection = db.collection('chat_history');
      collection.insert({
        username: socket.username,
        message: data,
        date: new Date()
      }).then(function(data){
      });
    }
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (user) {
    const db = app.locals.db;
    var usercollection = db.collection('users');
    if(user && users.indexOf(user.username) === -1) {
        usercollection.find({username:user.username, password:user.password}).toArray().then(function(data){
         if(!data.length){
          usercollection.insert({username:user.username, password:user.password}).then(function(data){
          });
         }
        });
        users.push(user.username);
        if (addedUser) return;
        //we store the username in the socket session for this client
        socket.username = user.username;
        ++numUsers;
        addedUser = true;
        //users.splice(users.indexOf(socket.username, 1));
        socket.emit('login', {
            numUsers: numUsers,
            users: users,
            loggedInUser: socket.username
        });
        var collection = db.collection('chat_history');
        collection.find({}).toArray().then(function(data){
          if(data.length){
            socket.emit('previous messages', {
            data : data
          });
          }
        })
        
        // echo globally (all clients) that a person has connected
        socket.broadcast.emit('user joined', {
          username: socket.username,
          users: users,
          numUsers: numUsers
        });
    }else if(users.indexOf(user.username) > -1){
      usercollection.find({username:user.username, password:user.password}).toArray().then(function(data){
         if(data.length){
            if (addedUser) return;
            //we store the username in the socket session for this client
            socket.username = user.username;
            //console.log(users.splice(users.indexOf(socket.username, 1)));
            //++numUsers;
            addedUser = true;
            socket.emit('login', {
              numUsers: numUsers,
                users:users,
            });
        }else{
          socket.emit('userExists', user.username + ' username is taken! Try some other username.');
        }
      });
    }else{
      
    }
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    if (addedUser) {
      --numUsers;
      users.slice(users.indexOf(socket.username),1);
      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });
});
