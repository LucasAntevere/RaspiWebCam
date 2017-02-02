module.exports = function() {    
    var shell = require('shelljs');
    var dateManager = require("./dateManager");
    var recordManager = require("./recordManager")();
    var result = require("./result");
    var bodyParser = require('body-parser')
    var fs = require("fs");
    var path = require("path");
    var express = require('express')
    var app = express()
    var configManager = require("./configManager");
    var temperatureManager = require("./temperatureManager");

    app.use(bodyParser.json()); 
    app.use(bodyParser.urlencoded({ extended: true })); 

    app.use("/public", express.static('public'));
    app.set("view engine", "ejs");

    app.get('/', function (req, res) {
        res.render("index");
    })

    app.post('/GetRecords', function (req, res) {
        var date = req.body.date;

        res.json(recordManager.getRecords(new Date(date)));        
    })

    app.get('/DownloadRecord/:recordName', function (req, res) {    
        const { recordName } = req.params;
        const movieFile = `${recordName}`;

        console.log(movieFile);

        fs.stat(movieFile, (err, stats) => {
            if (err) {
				console.log(err);
				return res.status(404).end('<h1>Movie Not found</h1>');
            }
            
            const { range } = req.headers;
            const { size } = stats;
            const start = Number((range || '').replace(/bytes=/, '').split('-')[0]);
            const end = size - 1;
            const chunkSize = (end - start) + 1;
            
            res.set({
            'Content-Range': `bytes ${start}-${end}/${size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': 'video/mp4'
            });
            
            res.status(206);
            
            const stream = fs.createReadStream(movieFile, { start, end });
            stream.on('open', () => stream.pipe(res));
            stream.on('error', (streamErr) => res.end(streamErr));
        });
    })

    app.post("/record", function(req, res){    
        res.json(new result(recordManager.record(), ["Não foi possível iniciar a gravação."]));
    });

    app.post("/stop", function(req, res){
        res.json(new result(recordManager.stop(), ["Não foi possível pausar a gravação."]));
    });

    app.get("/status", function(req, res){
        var canRecord = recordManager.canRecord();
        res.json(new result(true, ["teste", "de", "mensagem"], {
            canRecord: canRecord,
            canPause: !canRecord,
            canPreview: !canRecord,
            date: new Date()
        }));
    });

    app.post("/updateDate", function(req, res){
        var date = req.body.date;
        if (!date) {
            res.json(new result(false, "A data não pode ser nula."));        
        }else{
            date = new Date(date);
            var r = new dateManager().setSystemDate(date);
            recordManager.setTimeFixed(true);
            res.json(new result(r, ""));
        }
    });

    app.get("/stats", function(req, res){
        var automaticallyRecord = recordManager.canAutomaticallyRecord();

		var stats = recordManager.getStats();

        recordManager.getSpaceInfo(function(total, free){
            var freeGb = (free/ 1024 / 1024 / 1024);
            var totalGb = (total/ 1024 / 1024 / 1024);

			var availableHours = freeGb / ((totalGb - freeGb) / stats.totalHours);

            res.json(new result(true, "", {
                totalRecords: stats.totalRecords,
                totalHours: parseInt(stats.totalHours, 10) + ":" + ((Math.abs(parseInt(stats.totalHours, 10) - stats.totalHours)) * 60).toFixed(0),
                availableHours: parseInt(availableHours, 10) + ":" + ((Math.abs(parseInt(availableHours, 10) - availableHours)) * 60).toFixed(0),
                freeSpaceGb: freeGb,
                totalSpaceGb: totalGb,
                automaticallyRecord: automaticallyRecord
            }));
        });
    });	

    app.post("/shutdown", function(req, res){
        recordManager.stop();
        if(shell.exec("sudo poweroff").code == 0){
            res.json(new result(true, ""));
        }else{
            res.json(new result(false, ""));
        }
    });

    app.get('/config', function (req, res) {
        res.render("config");
    })

    app.get("/getConfigFile", function(req, res){		
        var config = configManager.readConfigFile();
        res.json(new result(true, "", config));
    });

    app.post("/saveConfigFile", function(req, res){
        var config = req.body.config;

        if(config){
            configManager.writeConfigFile(config);
            res.json(new result(true, "", config));
        }else{
            res.json(new result(false, "Novo arquivo de configuração inválido.", config));
        }
    });

    app.post("/stream", function(req, res){
        var stream = req.body.stream;
/*
        if (stream){
            fs.rename(path.join(__dirname, "public", "stream.jpg"), path.join(__dirname, "public", "stream2.jpg"), function(){
                fs.rename(path.join(__dirname, "public", "stream1.jpg"), path.join(__dirname, "public", "stream.jpg"), function(){
                    fs.rename(path.join(__dirname, "public", "stream2.jpg"), path.join(__dirname, "public", "stream1.jpg"), function(){
                        res.json(new result(true, ""));
                    });
                });
            });
            
            
        }else{

        }
        return;*/
        
        recordManager.stream(stream, function(success){
			res.json(new result(success, ""));        
		});
    });

    app.listen(3000, function () {
		temperatureManager.start();		
        console.log('Listening on port 3000!')
    });
}
