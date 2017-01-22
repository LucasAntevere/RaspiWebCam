var config = null;
$(window).on("load", function(){
    config = new Config();
});

function Config() {
    this.inputs = [];

    this.html = {
        $content: $("#content"),
        $btnSave: $("button.save")
    };

    this.init();
}

Config.prototype = {
    init: function(){
        this.html.$btnSave.click(this.save.bind(this));
        this.getConfigFile();
    },
    setup: function(config){
        for (var i in config){
            var input = new Input(i, config[i]);
            this.inputs.push(input);
            this.html.$content.append(input.getTemplate());
        }
    },
    getNewConfig: function(){
        var config = {};
        for (i = 0; i < this.inputs.length; i++){
            config[this.inputs[i].getName()] = this.inputs[i].getValue();
        }
        return config;
    },
    save: function(){
         $.ajax({
            method: "POST",
            url: "/saveConfigFile",
            data: { config: this.getNewConfig() }
        }).done(function(result){
            if(result.success){
                alert("Configurações atualizadas!");
            }else{
                alert("Erro ao atualizar as configurações. Erro: " + result.message);
            }
        }.bind(this)).fail();
    },
    getConfigFile: function(){
        $.ajax({
            method: "GET",
            url: "/getConfigFile"
        }).done(function(result){
            if(result.success){
                this.setup(result.result);
            }else{

            }
        }.bind(this)).fail();
    }
};

function Input(name, value){
    this.name = name;
    this.$label = $("<label>").text(name);
    this.$input = $("<input class='form-control' value='" + value + "'>");
    this.$group = $("<div class='form-group'>").append(this.$label).append(this.$input);
    this.$col = $("<div class='col-lg-12'>").append(this.$group);
}

Input.prototype = {
    getTemplate: function(){
        return this.$col;
    },
    getName: function(){
        return this.name;
    },
    getValue: function(){
        return this.$input.val();
    }
};