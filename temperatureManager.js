var shell = require("shelljs");
var fs = require("fs");
var configManager = require("./configManager");
var path = require("path");

function TemperatureManager(){
	this.seconds = 60;
	this.fileName = "temperature.json";
}

TemperatureManager.prototype = {
	start: function(){
		setInterval(this.measure.bind(this), this.seconds * 1000);
		this.measure();
	},
	measure: function(){
		shell.exec("/opt/vc/bin/vcgencmd measure_temp", { silent: false }, function(code, stdout, stderr){
			this.save(stdout);	
		}.bind(this));
	},
	save: function(rawResult){
		var result = new RegExp(/\d+(\.\d{1,2})?/).exec(rawResult);
		
		var temperature = null;
		if (result && result.length > 0)
			temperature = result[0];
			
		if (!temperature)
			return;
			
		this.log(temperature);
	},
	log: function(temperature){
		var obj = {
			d: new Date(),
			t: temperature
		};
		
		var dir = this.getFileDir();
		
		if (!fs.existsSync(dir))
			shell.mkdir("-p", dir);
		
		var fileName = this.getFilePath();
		
		if (!fs.existsSync(fileName))
			fs.writeFileSync(fileName, JSON.stringify([]));
		
		var result = JSON.parse(fs.readFileSync(fileName));
		result.push(obj);
		
		fs.writeFileSync(fileName, JSON.stringify(result));
	},
	getFileDir: function(){
		return configManager.get("logDir");
	},
	getFilePath: function(){
		return path.join(this.getFileDir(), this.fileName);
	}
};

module.exports = new TemperatureManager();
