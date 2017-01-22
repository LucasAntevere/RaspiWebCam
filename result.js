var Result = function(success, messages, result){
    this.result = result || null;
    this.success = success;
    this.messages = messages || []
};

Result.prototype = {
    addError: function(message){
        this.success =false;
        this.messages.push(message);
    },
    addWarning: function(message){        
        this.messages.push(message);
    },
    addResult: function(result){
        this.result = result;
    }
};

module.exports = Result;