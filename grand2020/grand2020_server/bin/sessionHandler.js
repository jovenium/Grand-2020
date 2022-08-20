/** Generate an uuid
 * @url https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript#2117523 **/
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        let r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function CoordExistMultipleTime(_action, responseActions){
    var action = JSON.parse(_action);
    for(let i = 0; i <responseActions.length;i++){
        //if not the same item
        if(JSON.parse(responseActions[i]).Timestamp != action.Timestamp || JSON.parse(responseActions[i]).login != action.login){
            if(JSON.stringify(JSON.parse(responseActions[i]).Coord) == JSON.stringify(action.Coord)){
                return true;
            }
        }
        
    }
    return false;
}

function GetActionWithSamePositionAndBiggerTimestamp(_action, actions){
    var action = JSON.parse(_action);
    var result = null;
    if(JSON.stringify(action.Modif) != "Erase" || JSON.stringify(action.Modif) != "Place" || JSON.stringify(action.Modif) != "PlaceAir" ){
        return null;
    }

    for(let i = 0; i <actions.length;i++){
        if(JSON.stringify(JSON.parse(actions[i]).Coord) == JSON.stringify(action.Coord) && JSON.parse(actions[i]).Timestamp > action.Timestamp){
            if(result == null){
                result = actions[i];
            }else if(JSON.parse(actions[i]).Timestamp > JSON.parse(result).Timestamp){
                result = actions[i];
            }
        }
    }
    return result;
}

function KeepLastActionByPosition(responseActions){
    var result = [];
    var index = -1;
    var timestamp = 0;
    //console.log("Start KeepLastActionByPosition");
    for(let i = 0; i <responseActions.length;i++){
        index = -1;
        for(let j = 0; j <result.length;j++){
            //if same position but not GhostBlocks -> update index.
            if((JSON.stringify(JSON.parse(responseActions[i]).Coord) == JSON.stringify(JSON.parse(result[j]).Coord) && (!JSON.stringify(JSON.parse(responseActions[i]).GhostMode) && !JSON.stringify(JSON.parse(result[j]).GhostMode)))){
                index = j;
                //console.log("index update :" + index);    
            }
        }
        if(index >= 0){
            if(JSON.parse(responseActions[i]).Timestamp > JSON.parse(result[index]).Timestamp){
                //console.log("replace with : " + responseActions[i]);
                for(let k = index; k < result.length - 1; k++){
                    result[k] = result[k+1];
                }
                //result[index] = responseActions[i];
                result.push(responseActions[i]);
            }
        }else{
            //console.log("push : " + responseActions[i]);
            result.push(responseActions[i]);
        }
    }
    //console.log("End KeepLastActionByPosition");
    return result;
}

function getFilteredUserName(username){
    const validChars = 'A-Za-z0-9';
    var regex = new RegExp('[^' + validChars + ']', 'g');
    return username.replace(regex, '');
}

class sessionHandler {

    constructor(id, eventDispatcher) {
        this.id = id;
        this.eventDispatcher = eventDispatcher;
        this.timeoutIds = [];
        this.clientLogins = [];
        this.actions = [];
        this.lastActionTimestamp = Date.now();
    }

    addUser(login) {
        this.clientLogins[login] = -1; //initialisation at -1 just to be sure that every player will get the first action.
        this.lastActionTimestamp = Date.now();
    }

    getUsers() {
        return Object.keys(this.clientLogins);
    }

    //is active if the last action was made in the last 20 minutes (1200000 ms)
    isActive() {
        return this.lastActionTimestamp + 1200000 > Date.now();
    }

    registerListener(req, res) {
        this.lastActionTimestamp = Date.now();
        var login = getFilteredUserName(req.query['login']);
        var needFullSync = false; 

        if(this.clientLogins[login] == undefined){
            res.sendStatus(401);
        }
        if(this.clientLogins[login] == -1){
            needFullSync = true;
        }

        res.setHeader('Content-Type', 'text/plain;charset=utf-8');
        res.setHeader("Cache-Control", "no-cache, must-revalidate");

        /*console.log(login);
        console.log(this.actions.length);
        console.log(this.clientLogins[login]);*/
        
        var responseActions = [];
        var NbActions = 0;
        if(this.clientLogins[login] == -1){
            this.clientLogins[login] = 0;
            responseActions = this.actions.slice(this.clientLogins[login]);//one action is sent two times
        }else{
            responseActions = this.actions.slice(this.clientLogins[login]);//one action is sent two times
        }
        NbActions = responseActions.length;
        //console.log("nb action OK");

        //console.log("add actionwithbiggestTimeStamp at position");
        var actionToAdd = null;
        if(!needFullSync){
            for(let i = 0; i < NbActions;i++){
                actionToAdd = GetActionWithSamePositionAndBiggerTimestamp(responseActions[i], this.actions);
                if(actionToAdd != null){
                    responseActions.push(actionToAdd);
                }
            }
        }
        //console.log("add actionwithbiggestTimeStamp at position OK");

        //keep last by position
        if(!needFullSync){
            responseActions = KeepLastActionByPosition(responseActions);
        }
        //console.log("filter by keep last by position OK");

        //filter by login
        //console.log(responseActions);
        if(!needFullSync){
            for(let i = 0; i <responseActions.length;i++){
                if(JSON.parse(responseActions[i]).login == login){
                    responseActions.splice(i, 1);
                    i--;
                }
            }
        }
        //console.log(responseActions);
        //console.log("filter remove by login OK");

        //message body response
        var message = '{"JsonBlocks":[';
        for(let i = 0; i <responseActions.length;i++){
            //console.log(responseActions[i]);
            message += responseActions[i] + ",";
        }
        message += ']}';
        this.clientLogins[login] = this.clientLogins[login] + NbActions;

        res.send(message);
    }

    sendMessage(req) {
        this.lastActionTimestamp = Date.now();
        let login = getFilteredUserName(req.query['login']) || "none";
        let message = req.body['data'] || "{}";
        var actionList = message.JsonBlocks;
        for (let i = 0; i <actionList.length;i++){
            //console.log(JSON.stringify(actionList[i]));
            this.actions.push(JSON.stringify(actionList[i]));
        }
    }
}

module.exports = sessionHandler; 
