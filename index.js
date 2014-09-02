'use strict';

var heartrate = require('./heartrate');

function Plugin(messenger, options, api, deviceName) {
    var self = this;
    if(!options){
        options = {};
    }
    if(typeof deviceName === 'string') {
        self.name = deviceName;
    }else if(deviceName){
        self.name = deviceName.name;
        self.uuid = deviceName.uuid;
    }else{
        self.name = require('./package.json').name;
        // Use Test UUID
        self.uuid = 'ega98481-3d45-11fO-8982-6b4asd5f4sska';
    }

    self.messenger = messenger;
    self.options = options || {};

    self.api = api; // Mobile Specific

    self.mobile = false;

    if(self.api && typeof self.api.logActivity === 'function'){
        self.mobile = true;
    }

    var logIt = function(err, msg){
        var obj = {
            type: self.name
        };
        if(err){
            obj.error = err;
        }
        if(msg){
            obj.html = msg;
        }
        if(self.mobile){
            self.api.logActivity(obj);
        }else{
            console.log('logIt (HeartRate): ' + JSON.stringify(obj));
        }
    };

    if(!options.addressKey){
        options.addressKey = 'heart_' + self.uuid;
    }

    function logHeartrate(hr){
        self.messenger.data({
            device : self.name,
            type : 'heartRate',
            heartRate : hr
        });
        logIt(null, 'Logged Heartbeat : ' + hr);
    }

    heartrate.init(options, {
        logIt : logIt,
        logHeartrate: logHeartrate
    });

    console.log('Initialized HeartRate Plugin');

    return self;
}

module.exports = {
    Plugin: Plugin
};