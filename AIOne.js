

function AIOne() {
    this.baseUrl = "https://api.groq.com/openai/v1";
    this.apiKey = "";
}

var aiOne = new AIOne();

function onLoad() {
    var apiForm = document.getElementById("api-form");
    /** @type {HTMLInputElement?} */
    var apiKeyInput = document.getElementById("api-key-input");
    var inputForm = document.getElementById("message-form");

    apiForm.onsubmit = function(ev) {
        ev.preventDefault();

        console.log("Sending model request...");
        if (apiKeyInput) {
            aiOne.apiKey = apiKeyInput.value.trim();
        }
    };


    inputForm.onsubmit = function(ev) {
        ev.preventDefault();

        console.log("Sending message...");
    };
}

window.addEventListener("load", onLoad, false);