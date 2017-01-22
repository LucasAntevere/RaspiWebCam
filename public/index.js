var app = null;

$(window).on("load", function(){
    $.fn.extend({
        lock: function(lock){
            if (lock){
                return $(this).addClass("disabled").attr("disabled", "disabled");
            }else{
                return $(this).removeClass("disabled").attr("disabled", null);
            }
        }
    });

    moment.locale('pt-br');
    app = new App();    
});

function App() {
    this.html = {
        $content: $(".content"),
        $bottomInfo: $(".bottom-message"),
        $totalRecords: $("#total-records"),
        $availableSpace: $("#available-space"),
        $totalHours: $("#total-hours"),
        $automaticallyRecord: $("#automaticallyRecord"),
        $serverDate: $("#server-date"),
        $stream: $("#stream")
    };

    this.buttons = {
        $update: $("button#update"),
        $record: $("button#record"),
        $stop: $("button#stop"),
        $stream: $("button#btn-stream"),
        $previous: $("#previous"),
        $next: $("#next"),
        $shutdown: $("#shutdown")
    };

    this.inputs = {
        $date: $("#date")
    };

    this.dateFormat = "YYYY-MM-DD";

    this.isStreaming = false;

    this.items = [];

    this.init();
}

App.prototype = {
    init: function() {
        this.updateDate();

        this.inputs.$date.change(this.onUpdateClick.bind(this));
        this.buttons.$update.click(this.onUpdateClick.bind(this));
        this.buttons.$record.click(this.onRecordClick.bind(this));
        this.buttons.$stop.click(this.onStopClick.bind(this));
        this.buttons.$next.click(this.onNextClick.bind(this));
        this.buttons.$previous.click(this.onPreviousClick.bind(this));
        this.buttons.$shutdown.click(this.onShutdownClick.bind(this));
        this.buttons.$stream.click(this.onStreamClick.bind(this));
        this.html.$stream.on("load", this.onStreamLoad.bind(this));

        this.setDate(new Date());

        this.onUpdateClick();

        this.getStatus();
        this.getStats();
        setInterval(this.getStatus.bind(this), 5000);
    },
    onStreamClick: function(){
        if(this.isStreaming){
            this.isStreaming = false;
            this.html.$stream.hide();
            this.html.$content.show();
            this.stream(false);       
        }else{
            this.html.$content.hide();
            this.html.$stream.show();            
            this.isStreaming = true;            
            this.stream(true);       
        }
    },
    stream: function(stream){
        $.ajax({
            method: "POST",
            url: "/stream",
            data: {
                stream: stream
            }
        }).done(function(result){
            if(result.success){
                if (stream)
                    this.updateStream();                       
            }else{
                this.setMessage("Houve um erro ao realizar o stream.");
            }
        }.bind(this)).fail(function(){

        });
    },
    updateStream: function(){
        this.html.$stream.attr("src", "/public/stream.jpg?p=" + new Date().getTime());                
    },
    onStreamLoad: function(){
        if(!this.isStreaming) return;

        this.stream(true);
    },
    setDate: function(date){
        this.inputs.$date.val(moment(date).format(this.dateFormat));
    },
    getDate: function(){
        return moment(this.inputs.$date.val(), this.dateFormat).toDate();
    },
    addItem: function(item){
        this.items.push(item);
        item.setOnToggleCallback(this.onItemToggle.bind(this));
        this.html.$content.append(item.getTemplate());
    },
    onItemToggle: function(item){
        if(item.isOpened()){
            $(this.items).each(function(i, it){
                if(it.isOpened() && item != it)
                    it.close();
            });
        }else{

        }
    },
    onUpdateClick: function(){        
        this.getRecords(this.getDate());
    },
    onRecordClick: function(){
        this.startRecording();
    },
    onStopClick: function(){
        if(confirm("Deseja pausar a gravação?"))
            this.stop();
    },
    onShutdownClick: function(){
        if(confirm("Deseja desligar a câmera? Isso pode demorar até um minuto."))
            this.shutdown();
    },
    onNextClick: function(){
        this.setDate(moment(this.getDate()).add(1, "days"));
        this.onUpdateClick();
    },
    onPreviousClick: function(){
        this.setDate(moment(this.getDate()).add(-1, "days"));
        this.onUpdateClick();
    },
    clearItems: function(){
        $(this.items).each(function(i, item){
            item.remove();            
        });
        this.items = [];
    },
    updateStatus: function(status){        
        this.buttons.$record.lock(!status.canRecord);
        this.buttons.$stop.lock(!status.canPause);    

        this.buttons.$record.find("span:last-child").text(!status.canRecord ? "Gravando..." : "Gravar");            

        this.html.$serverDate.text(moment(status.date).format("DD/MM/YY HH:mm:ss"));
    },
    updateStats: function(stats){
        this.html.$totalHours.text(stats.totalHours.toFixed(2) + "/" + stats.availableHours.toFixed(2) + " horas");
        this.html.$totalRecords.text(stats.totalRecords + " gravações");
        this.html.$availableSpace.text((stats.totalSpaceGb - stats.freeSpaceGb).toFixed(2) + "/" + stats.totalSpaceGb.toFixed(2) + " Gb");
        this.html.$automaticallyRecord.text("Gravação Automática ");                
        
        if(stats.automaticallyRecord)
            this.html.$automaticallyRecord.append($("<span class='glyphicon glyphicon-ok'>"));
        else
            this.html.$automaticallyRecord.append($("<span class='glyphicon glyphicon-remove'>"));
    },
    startRecording: function(){
        $.ajax({
            method: "POST",
            url: "/record"
        }).done(function(result){
            console.debug(result);
        }.bind(this)).fail(function(){

        });
    },
    getStatus: function(){
        $.ajax({
            method: "GET",
            url: "/status"
        }).done(function(data){
            if(data.success){
                this.updateStatus(data.result);
            }else{

            }
        }.bind(this)).fail(function(){

        });
    },
    getStats: function(){
        $.ajax({
            method: "GET",
            url: "/stats"
        }).done(function(data){
            if(data.success){
                this.updateStats(data.result);
            }else{

            }
        }.bind(this)).fail(function(){

        });
    },
    getRecords: function(date){
        this.clearItems();
        $.ajax({
            method: "POST",
            url: "/GetRecords",
            data: {date: moment(date).format()}
        }).done(function(records){
            $(records).each(function(i, record){
                this.addItem(new Item(record));
            }.bind(this));
        }.bind(this)).fail(function(){

        });
    },
    updateDate: function(){
         $.ajax({
            method: "POST",
            url: "/updateDate",
            data: {date: moment().format()}
        }).done(function(data){
            
        }.bind(this)).fail(function(){

        });
    },
    shutdown: function(){
        $.ajax({
            method: "POST",
            url: "/shutdown"
        }).done(function(data){
            
        }.bind(this)).fail(function(){

        });
    },
    setMessage: function(messages){
        if (!(messages instanceof Array))
            messages = [messages];
        
        for (var i = 0; i < messages.length; i++){
            this.html.$bottomInfo.text(messages[i]);
        }
    }
};

function Item(data){
    this.data = data;

    this.$template = $($("#item").html()).clone();

    this.html = {
        $title: this.$template.find("h1"),
        $video: this.$template.find(".video"),
        video: {
            $video: null,
            $source: null
        }
    };

    this.opened = false;

    this.callback = {};

    this.init();
}

Item.prototype = {
    init: function(){
        this.initVideo();

        this.html.$title.html(this.getTitle());
        this.html.$title.click(this.onItemClick.bind(this));

        this.html.$video.append(this.html.video.$video);

        this.setVideoVisible(false);
    },
    initVideo: function(){
        this.html.video.$video =  $("<video controls>");        
        this.html.video.$source = $("<source type='video/mp4'>");            
        this.html.video.$video.append(this.html.video.$source);
    },
    getTemplate: function(){
        return this.$template;        
    },
    remove: function(){
        this.$template.remove();
    },
    onItemClick: function(){
        this.toggle();
    },
    isOpened: function(){
        return this.opened;
    },
    getVideoUrl: function(){
        return "/DownloadRecord/" +  encodeURIComponent(this.data.dir);
    },
    getTitle: function(){
        var date = new Date(this.data.date);

        return moment(this.data.startDate).format("ddd [<b>]HH:mm[</b>]:ss") + " - " +
               moment(this.data.endDate).format("ddd [<b>]HH:mm[</b>]:ss");
    },
    toggle: function(){
        if (this.isOpened())
            this.close();
        else
            this.open();
    },
    open: function(){
        if(this.isOpened()) return;
        this.setVideoVisible(true);
        this.opened = true;

        if(this.callback.onToggle) this.callback.onToggle(this);
    },
    close: function(){
        if(!this.isOpened()) return;
        this.setVideoVisible(false);
        this.opened = false;

        if(this.callback.onToggle) this.callback.onToggle(this);
    },
    setVideoVisible: function(visible){
        if(visible){            
            this.html.$video.slideDown();        
            
            this.html.video.$source.attr("src", this.getVideoUrl());  
            this.html.video.$video[0].load();            
            this.html.video.$video[0].play();            
        } else {
            this.html.$video.slideUp();
            this.html.video.$source.attr("src", "");            
            this.html.video.$video[0].load();            
        }
    },
    setOnToggleCallback: function(callback){
        this.callback.onToggle = callback;
    }
};