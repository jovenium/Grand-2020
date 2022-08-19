let router = require('express').Router();
let fs = require('fs');
let sessionHandler = require(`../bin/sessionHandler.js`);
//let editorSession;
let editorSession = [];
let users = {};
const filePath = 'public/files/Grand2020.Script.txt';
const filePathMetaData = 'public/files/metadata.json';
var redis = require('redis');
var RedisStatus = true;
const client = redis.createClient({
    //url: 'redis://default:@127.0.0.1:6379'
    url: 'redis://default:@grand2020-redis:6379'
  });
console.log("ok");

/** Generate an uuid
 * @url https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript#2117523 **/
 function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        let r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function getUserByToken(token) {
    var objKey = Object.keys(users).find(key => {
        return users[key].token === token;
    });
    return users[objKey];
}


function ensureValidId(req, res, next) {
    req.InstanceId = req.params.id;
    //console.log(req.body['data']['token']);
    req.user = getUserByToken(req.body['data']['token']);
    if (req.user !== null) {
        if (editorSession[req.InstanceId] !== undefined) {
            next();
        } else {
            res.sendStatus(403);
            res.end();
        }
    } else {
        // end 
        res.sendStatus(404);
        res.end();
    }
}

function getPluginVersion() {
    var metadata = JSON.parse(fs.readFileSync(filePathMetaData));
    if(metadata.version != undefined){
        return metadata.version;
    }
    return "unknown";
}

function redisIncrPlayer(login){
    if (!RedisStatus) return;
    client.incr("player_party_count:"+login);
}

function redisIncrGlobalPartyCount(){
    if (!RedisStatus) return;
    client.incr("global_party_count");
}

async function setRedisStatus(){
    RedisStatus = false;
    console.log("Redis Connection Status :");
    console.log(RedisStatus);
}

module.exports = function (eventDispatcher) {

    /**
     * Setup redis database
     */
    //client.on('error', (err) =>  console.log('Redis Client Error', err));
    client.on('error', (err) => setRedisStatus());
    client.connect();
    if(RedisStatus){
        client.setNX("global_party_count", "0");
    }
    

    router.get('/', async (req, res) => {
        /*if (req.useragent.browser === "ManiaPlanet") {
            res.sendfile("public/test.xml");
            return;
        }*/
        let nb_rooms = 0;
        let nb_players = 0;
        let rooms = {};
        let room_number = 0;
        var global_party_count = 0;
        var global_player_count = 0;

        if (RedisStatus){
        global_party_count = await client.get("global_party_count");
        global_player_count = await client.keys("player_party_count:*");
        global_player_count = global_player_count.length;
        }

        //delete inactive editorSessions
        for(key in editorSession){
            if(!editorSession[key].isActive()){
                delete editorSession[key];
            }
        }
        //delete users from closed editorSessions
        for(user in users){
            if(editorSession[users[user].room] === undefined){
                delete users[user];
            }
        }
        //create room description (title + payer logins list)
        for(editor in editorSession){
            rooms[room_number] = {
                title : "Room #"+room_number,
                logins : editorSession[editor].getUsers()
            };
            room_number += 1;
        }
        nb_rooms = room_number;
        nb_players = Object.keys(users).length;
        
        res.render('index', {title: 'GRAND2020', nb_lobbies: nb_rooms, nb_players : nb_players, rooms : rooms,
                    global_party_count : global_party_count, global_player_count: global_player_count});
    });

    router.get('/download', function (req, res, next) {
        let last_update = '';
        let version = getPluginVersion();

        const getFileUpdatedDate = (path) => {
            const stats = fs.statSync(path)
            return stats.mtime
          }

        const diffTime = Math.abs(new Date() - getFileUpdatedDate(filePath));
        const diffMins = Math.ceil(diffTime / (1000 * 60));
        const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30)); 

        if(diffMins < 60){
            last_update = diffMins + ' mins ago';
        }else if (diffHours < 24){
            last_update = diffHours + ' hrs ago';
        }else if (diffDays < 30){
            last_update = diffDays + ' days ago';
        }else if (diffMonths < 12){
            last_update = diffMonths + ' months ago';
        }else{
            const diffYears = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30 * 12)); 
            last_update = diffYears + ' years ago';
        }
        
        res.render('download', {title: 'Download', plugin_version : version, last_update : last_update});
    });

    router.get('/download/latest', function (req, res, next) {
        res.download(filePath);
    });

    //return the latest version of the plugin
    router.get('/version', function (req, res, next) {
        var version = getPluginVersion();
        res.send(version);

        //res.send("                          Latest Version : 1.0             Some UI added, bug fix.");
    });

    //admin role can create the session if not exists. If you rejoin a session, your synchro is restarted
    // role = 1 -> Admin/Creator of the room
    router.post('/:id/join', function (req, res, next) {
        let body = req.body['data'];
        let id = req.params.id;
        //create the session if doesnot exist and return a session token
        if (editorSession[id] === undefined && body['role'] == 1) {
            editorSession[id] = new sessionHandler(id, eventDispatcher);
        }else if(editorSession[id] === undefined && body['role'] != 1){
            res.sendStatus(404);
            return;
        }

        /**
         * Add user to redis if does not exists and incr his party count
         */
        redisIncrPlayer(body['login']);
        if(body['role'] == 1){
            redisIncrGlobalPartyCount();
        }
        
        editorSession[id].addUser(body['login']);

        let tok = uuidv4();
        users[body['login']] = {
            token: tok,
            room: id,
            login: body['login'],
            role: body['role'],
        };

        let jsonResponse = {
            token: tok
        };

        res.send(JSON.stringify(jsonResponse));
    });

    router.post('/:id/listener', ensureValidId, function (req, res, next) {
        editorSession[req.InstanceId].registerListener(req, res);
        //console.log("ok.");
    });

    router.post('/:id/push', ensureValidId, function (req, res, next) {
        // here we compose the message to be sent
        //editorSession = new sessionHandler("test",eventDispatcher);
        editorSession[req.InstanceId].sendMessage(req);
        res.send("ok.");
    });

    return router;
};
