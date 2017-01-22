var shell = require('shelljs');
var fs = require("fs");
var raspicam = require("raspicam");
var moment = require("moment");
var diskspace = require("diskspace");
var path = require("path");

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
    this.configFileName = "config.json";

    this.ops = this.readConfigFile() || {};
    this.init();
};

RecordManager.prototype = {
    init: function(){
        this.checkTempDirectory();
        this.checkEmptyDirectories();
        this.startAutomatically();      
    },
    getConfigFilePath: function(){
        return path.join(__dirname, this.configFileName);
    },
    writeCondigFile: function(config){
        var configPath = this.getConfigFilePath();
         if(fs.existsSync(configPath)){             
            fs.writeFileSync(configPath, JSON.stringify(config));       

            this.ops = this.readConfigFile();

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
    checkEmptyDirectories: function(){
        var dirs = fs.readdirSync(this.ops.recordPath);

        for (i = 0; i < dirs.length; i++){
            if(dirs[i] == this.ops.tempFolderName) continue;

            var files = fs.readdirSync(path.join(this.ops.recordPath, dirs[i])); 
            if(!files.length) fs.rmdirSync(path.join(this.ops.recordPath, dirs[i]));  
        }
    },
    checkTempDirectory: function(){
        var dir = this.getTempDir();
        var files = fs.readdirSync(dir);

        for (i = 0; i < files.length; i ++){
            this.moveToCorrectDir(path.join(dir, files[i]));
        }
    },
    canAutomaticallyRecord: function(){
        return this.ops.autoRecord && !this.stopManually && this.timeFixed;
    },
    startAutomatically: function(){
        if (this.canAutomaticallyRecord())        
            this.record();  
    },
    canRecord: function(){
        return !this.isRecording;
    },
    record: function(){
        if (this.isRecording || this.isStreaming) return false;
        
        this.camera =  new raspicam({
            mode: "video",
            output: path.join(this.getTempDir(), this.getTempFileName()),
            w: this.ops.width,
            h: this.ops.height,
            b: this.ops.bitrate,
            fps: this.ops.framerate,
            t: this.ops.videoLimitSeconds,
            nopreview: this.ops.nopreview,
            vstab: this.ops.vstab
        });
        
        this.setCameraEvents(this.camera);

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
            
            fs.rename(filePath, path.join(this.getDir(obj.startDate), this.getFileName(obj.startDate, obj.endDate)));
    },
    onSaveRecord: function(err, timestamp, filename){
        if(!fs.existsSync(filename)) return;
        
        this.checkTempDirectory();
                
        this.camera = null;
        
        this.isRecording = false;

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
        
        var dir = path.join(this.ops.recordPath, moment(date).format(this.ops.folderDateFormat));

        this.createIfNotExistsDir(dir);

        return dir;
    },
    getTempDir: function(){
        var dir = path.join(this.ops.recordPath,  this.ops.tempFolderName);

        this.createIfNotExistsDir(dir);

        return dir;
    },
    getTempFileName: function(){
        return this.getFileName(new Date(), null);
    },
    getFileName: function(startDate, endDate){
        return this.dateToString(startDate) + ";" + this.dateToString(endDate) + this.ops.extension;

        return (JSON.stringify({
            startDate: this.dateToString(startDate),
            endDate: this.dateToString(endDate)
        }) + this.ops.extension).replace(/:/g, ";;").replace(/"/g, "'");
    },
    readFileName: function(fileName){
        var parts = path.basename(fileName, path.extname(fileName)).replace(/;;/g, ":").replace(/'/g, "\"").split(";");

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
        return moment(date).format(this.ops.fileDateFormat);
    },
    stringToDate: function(string){
        return moment(string, this.ops.fileDateFormat).toDate();
    },
    getAllRecords: function(){
        var files = [];

        var dirs = fs.readdirSync(this.ops.recordPath);

        for (i = 0; i < dirs.length; i++){
            files = files.concat(fs.readdirSync(path.join(this.ops.recordPath, dirs[i])));    
        }

        var json = [];
        
        for (i = 0; i < files.length; i++)
            json.push(this.readFileName(files[i]));            

        return json;
    },
    getSpaceInfo: function(callback){
        diskspace.check(this.ops.recordPartition, function(err, total, free, status){
            callback(total, free);
        });        
    },
    setTimeFixed: function(){
        this.timeFixed = true;
    },
    stream: function(stream){
        if(this.isRecording) return false;

        if (stream){
            if(this.isStreaming) return true;
            
            this.isStreaming = true;

            this.camera =  new raspicam({
                mode: "photo",
                output: path.join(__dirname, "public", "stream.jpg"),
                w: 640,
                h: 480,
                q: 100            
            });
        
            var result = this.camera.start();
            this.isStreaming = false;
            this.camera = null;
            return result;
        }else{
            this.isStreaming = false;
            return true;
        }
    }
};

module.exports = getInstance;