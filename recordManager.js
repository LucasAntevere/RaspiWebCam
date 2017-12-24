var shell = require('shelljs');
var fs = require("fs");
var raspicam = require("raspicam");
var moment = require("moment");
var diskspace = require("diskspace");
var path = require("path");
var configManager = require("./configManager");
var disk = require('diskusage');

var _instance;

function getInstance(){
    if (!_instance)
        _instance = new RecordManager();
    
    return _instance;
}

var RecordManager = function() {  
    this.isStreaming = false;
    this.stopManually = false;
    this.camera = null;
    this.isRecording = false;
    this.timeFixed = false;

    this.init();
};

RecordManager.prototype = {
    init: function(){
		this.log("RecordManager.Init()");
		
        this.checkTempDirectory();
        this.checkEmptyDirectories();
        this.startAutomatically();      
    },
    checkEmptyDirectories: function(){
		this.log("Início da checagem de diretórios vazios.");
		
        var dirs = fs.readdirSync(configManager.get("recordPath"));

        for (i = 0; i < dirs.length; i++){
            if(dirs[i] == configManager.get("tempFolderName")) continue;

            var files = fs.readdirSync(path.join(configManager.get("recordPath"), dirs[i])); 
            if(!files.length) fs.rmdirSync(path.join(configManager.get("recordPath"), dirs[i]));  
        }
        
        this.log("Fim da checagem de diretórios vazios.");
    },
    checkTempDirectory: function(){
		this.log("Início da checagem do diretório temporário.");
		
        var dir = this.getTempDir();
        var files = fs.readdirSync(dir);

        for (i = 0; i < files.length; i ++){
            this.moveToCorrectDir(path.join(dir, files[i]));
        }
        
        this.log("Fim da checagem do diretório temporário.");
    },
    canAutomaticallyRecord: function(){
        return configManager.get("autoRecord") && !this.stopManually && this.timeFixed;
    },
    startAutomatically: function(){
		this.log("Início da verificação para iniciar a auto gravação.");
        if (this.canAutomaticallyRecord()) {
			this.log("Auto gravação iniciada.");
			setTimeout(this.record.bind(this), 1000);              
		}
        else
			this.log("Auto gravação não iniciada.");
		this.log("Fim da verificação para iniciar a auto gravação.");
    },
    canRecord: function(){
        return !this.isRecording;
    },
    record: function(){
        if (this.isRecording || this.isStreaming) return false;
        
        var recordPath = path.join(this.getTempDir(), this.getTempFileName());
                
        this.camera =  new raspicam({
            mode: "video",
            output: recordPath,
            t: configManager.get("videoLimitSeconds") * 1000,
            w: configManager.get("width"),
            h: configManager.get("height"),
            bitrate: configManager.get("bitrate"),
            framerate: configManager.get("framerate"),
            hflip: configManager.get("hflip"),
            vflip: configManager.get("vflip"),
            rotation: configManager.get("rotation"),
            nopreview: configManager.get("nopreview")
  //          vstab: this.ops.vstab,
//            log: __dirname
        });
        
        this.setCameraEvents(this.camera);

		this.log("Início da gravação (" + recordPath + ").");
        var started = this.camera.start();

        this.stopManually = false;
        this.isRecording = started;

        return started;
    },    
    stop: function(){
        if (!this.isRecording) return false;

        this.stopManually = true;

        return this.camera.stop();
    },
    setCameraEvents: function(camera){
        camera.on("read", this.onSaveRecord.bind(this));
        camera.on("exit", this.onTimesoutRecord.bind(this));
    },
    onTimesoutRecord: function(timestamp){
        this.onSaveRecord(null, timestamp, this.getTempDir());
    },
    moveToCorrectDir: function(filePath){
            var filename = path.basename(filePath);

            var obj = this.readFileName(filename);
            if (obj.startDate) 
                obj.startDate = new Date(obj.startDate);
            else
                obj.startDate = new Date();
            
            if (obj.endDate) 
                obj.endDate = new Date(obj.endDate);
            else
                obj.endDate = new Date();
                
            
            var newFileDir = this.getDir(obj.startDate);
            
            this.createIfNotExistsDir(newFileDir);
            
            var newFilePath = path.join(newFileDir, this.getFileName(obj.startDate, obj.endDate));
            
		var framerate = configManager.get("framerate");

            if(path.extname(filePath) == ".h264"){
				var mp4Command  ="MP4Box -add " + filePath + " " + newFilePath + " -fps " + framerate;
				  
				this.log("Início da conversão do arquivo. (" + mp4Command + ")");
				shell.exec(mp4Command, { silent: false }, 
					function(code, stdout, stderr){
						if (stdout.toLowerCase().indexOf("error") != -1){
							this.log("Erro ao converter o arquivo: " + filePath);
							this.log(stdout);
							this.log(stderr);	
						}else{
							this.log("Fim da conversão do arquivo (" + filePath + ") para (" + newFilePath + ")");
							fs.unlinkSync(filePath);	
							
							this.updateStats(newFilePath);
						}
				}.bind(this));
			}else{                        
				fs.rename(filePath, newFilePath);
			}
    },
    onSaveRecord: function(err, timestamp, filename){
        if(!fs.existsSync(filename)) return;
        
        this.checkTempDirectory();
                
        this.camera = null;
        
        this.isRecording = false;

		this.log("Fim da gravação (" + filename + ").");
        this.startAutomatically();
    },
    getRecords: function(date){
        if(!date) return null;

        var dir = this.getDir(date);

        this.createIfNotExistsDir(dir);

        var records = fs.readdirSync(dir);
        
        var result = [];

        for (i = 0; i < records.length; i++){
            var dates =  records[i].split("=");

            var obj = this.readFileName(records[i]);
            obj.dir = path.join(dir, records[i]);
            obj.name = records[i];              

            result.push(obj);
        }

        return result;
    },
    getDir: function(date){
        if(!date) return null;
        
        var dir = path.join(configManager.get("recordPath"), moment(date).format(configManager.get("folderDateFormat")));

        this.createIfNotExistsDir(dir);

        return dir;
    },
    getTempDir: function(){
        var dir = path.join(configManager.get("recordPath"),  configManager.get("tempFolderName"));

        this.createIfNotExistsDir(dir);

        return dir;
    },
    getTempFileName: function(){
        return this.getFileName(new Date(), null);
    },
    getFileName: function(startDate, endDate){
        return this.dateToString(startDate) + "__" + this.dateToString(endDate) + configManager.get("extension");

        return (JSON.stringify({
            startDate: this.dateToString(startDate),
            endDate: this.dateToString(endDate)
        }) + configManager.get("extension")).replace(/:/g, ";;").replace(/"/g, "'");
    },
    readFileName: function(fileName){
        var parts = path.basename(fileName, path.extname(fileName)).split("__");

        return {
            startDate: parts.length >= 1 && parts[0] ? this.stringToDate( parts[0]) : null,
            endDate: parts.length >= 2 && parts[1] ? this.stringToDate( parts[1]) : null
        };

        return JSON.parse(fileName.replace(/;;/g, ":").replace(/'/g, "\""));
    },
    createIfNotExistsDir: function(dir){
        if (!fs.existsSync(dir))
            shell.mkdir("-p", dir);
    },
    getFilePath: function(startDate, endDate){
        if (!startDate || !endDate) return;

        var dir = this.getDir(startDate);

        return path.join(dir, this.getFileName(startDate, endDate));
    },
    dateToString: function(date){
        if (!date) return "";
        return moment(date).format(configManager.get("fileDateFormat"));
    },
    stringToDate: function(string){
        return moment(string, configManager.get("fileDateFormat")).toDate();
    },
    getAllRecords: function(){
        var files = [];

        var dirs = fs.readdirSync(configManager.get("recordPath"));

        for (i = 0; i < dirs.length; i++){
            files = files.concat(fs.readdirSync(path.join(configManager.get("recordPath"), dirs[i])));    
        }

        var json = [];
        
        for (i = 0; i < files.length; i++)
            json.push(this.readFileName(files[i]));            

        return json;
    },
    getSpaceInfo: function(callback){
        /*diskspace.check(configManager.get("recordPartition"), function(err, total, free, status){			
            callback(total, free);
        });        */
        disk.check(configManager.get("recordPartition"), function(err, info) {
            if (err) {
                console.log(err);
            } else {
                callback(info.total, info.free);
            }
        });
    },
    setTimeFixed: function(){
        this.timeFixed = true;
    },
    stream: function(stream, cb){
        if(this.isRecording) return cb(false);

        if (stream){
            if(this.isStreaming) return cb(true);
            
            this.isStreaming = true;

		    this.camera =  new raspicam({
                mode: "photo",
                output: path.join(__dirname, "public", "stream.jpg"),
                w: 640,
                h: 480,
                q: 30,
                t: 1,
                nopreview: false
            });
        
			this.camera.on("read", function(){										
					setTimeout(function(){
						this.isStreaming = false;
						this.camera = null;
						cb(true);
					}.bind(this), 1000);					
			}.bind(this));
			
			this.camera.on("stop", function(){															
					this.isStreaming = false;
					this.camera = null;
					cb(false);					
			}.bind(this));
        
            var result = this.camera.start();            
            if (!result)
				cb(result);
        }else{
            this.isStreaming = false;
            return cb(true);
        }
    },
    log: function(message){
		var logPath = path.join(configManager.get("logDir"), "log.txt");
		this.createIfNotExistsDir(configManager.get("logDir"));

		fs.appendFileSync(logPath, "\n" + moment().format("YYYY-MM-DD HH:mm:ss") + " | " + message);		
	},
	updateStats: function(filePath){
		var fileName = this.readFileName(filePath);
		var stats = this.getStats();
				
		var start = fileName.startDate.getTime();
		var end = fileName.endDate.getTime();

		stats.totalHours += Math.abs((((end - start)  / (1000*60*60)) % 24));
		stats.totalRecords += 1;
		
		fs.writeFileSync(this.getStatsPath(), JSON.stringify(stats));		
	},
	getStatsPath: function(){
		return path.join(configManager.get("logDir"), "stats.json");
	},
	getStats: function(){ 
		var statsPath = this.getStatsPath();
		this.createIfNotExistsDir(configManager.get("logDir"));
		
		if(!fs.existsSync(statsPath)){
            fs.writeFileSync(statsPath, JSON.stringify({
					totalHours: 0,
					totalRecords: 0
			}));            
		}
		
		return JSON.parse(fs.readFileSync(statsPath));
	}
};

module.exports = getInstance;
