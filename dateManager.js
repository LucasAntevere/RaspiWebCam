var shell = require('shelljs');
var moment = require("moment");

var DateManager = function(){    
    this.dateFormat = "YYYYMMDD";
    this.timeFormat = "hh:mm:ss";
}

DateManager.prototype = {
    setSystemDate: function(date){
        if ("linux" == process.platform){            
            var dr = shell.exec("sudo date +%Y%m%d -s \"" + moment(date).format(this.dateFormat) + "\"");
            var tr = shell.exec("sudo date +%T -s \"" + moment(date).format(this.timeFormat) + "\"");

            return dr + tr == 0;
        }
    }    
};

module.exports = DateManager;