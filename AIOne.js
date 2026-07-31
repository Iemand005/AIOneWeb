

function AIOne() {
    this.baseUrl = "https://api.groq.com/openai/v1";
    this.apiKey = "";
}

function onLoad() {
    var apiForm = document.getElementById("api-form");
    var apiKeyInput = document.getElementById("api-key-input");
    var inputForm = document.getElementById("message-form");
    
    apiForm.onsubmit = function(ev) {
        ev.preventDefault();

        console.log("Sending model request...");

    };


    inputForm.onsubmit = function(ev) {
        ev.preventDefault();

        console.log("Sending message...");
    };
}

window.addEventListener("load", onLoad, false);