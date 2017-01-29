var path = require("path");
var fs = require("fs");

function ConfigManager(){
	this.configFileName = "config.json";
	
	this.ops = null;
	
	this.init();
}

ConfigManager.prototype = {
	init: function(){
		this.refresh();		
	},
	refresh: function(){
		this.ops = this.readConfigFile();
	},
	getConfigFilePath: function(){
        return path.join(__dirname, this.configFileName);
    },
    writeConfigFile: function(config){
        var configPath = this.getConfigFilePath();
         if(fs.existsSync(configPath)){             
            fs.writeFileSync(configPath, JSON.stringify(config));       

            this.refresh();

            return true;
        }else{
            return false;
        }        
    },
    readConfigFile: function(){
        var configPath = this.getConfigFilePath();
        if(fs.existsSync(configPath)){
            var config = fs.readFileSync(configPath);
            return JSON.parse(config);
        }else{
            return null;
        }        
    },
    get: function(name){
		return this.ops[name];
	}
}

module.exports = new ConfigManager();
