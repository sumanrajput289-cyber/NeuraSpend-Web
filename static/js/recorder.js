/*
 * NeuraSpend Voice Capturer Script
 * Interfaces browser-native Web Speech APIs (SpeechRecognition / webkitSpeechRecognition).
 * Translates speech to text directly in-browser in real time and handles parsing asynchronously.
 */

let recognition = null;
let isRecording = false;

// Initialize native browser Web Speech Recognition
const BrowserSpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function toggleVoiceRecording(micBtn, statusLbl, successCallback) {
    if (!BrowserSpeechRecognition) {
        successCallback(false, 'Speech recognition is not supported in this browser. Please use Google Chrome, MS Edge, or Apple Safari.');
        return;
    }

    if (!isRecording) {
        try {
            recognition = new BrowserSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            recognition.onstart = () => {
                isRecording = true;
                micBtn.classList.add('recording');
                statusLbl.textContent = 'Listening... Speak your transaction clearly.';
            };

            recognition.onresult = async (event) => {
                const transcript = event.results[0][0].transcript;
                statusLbl.textContent = 'Speech translated! Parsing transaction...';
                
                // Submit text to local deterministic NLP regex parser API
                try {
                    const response = await fetch('/api/parser', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: `text=${encodeURIComponent(transcript)}`
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        // Package results to match app.js handlers
                        const parsedData = result.data;
                        parsedData.raw_text = transcript;
                        successCallback(true, parsedData);
                    } else {
                        successCallback(false, 'NLP Parsing engine failed.');
                    }
                } catch (err) {
                    successCallback(false, 'Failed to connect to local parsing server.');
                }
            };

            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                if (event.error === 'not-allowed') {
                    successCallback(false, 'Microphone permission denied. Enable microphone access in browser settings.');
                } else if (event.error === 'no-speech') {
                    successCallback(false, 'No speech was detected. Please speak clearer.');
                } else {
                    successCallback(false, `Voice recognition error: ${event.error}`);
                }
            };

            recognition.onend = () => {
                isRecording = false;
                micBtn.classList.remove('recording');
                statusLbl.textContent = 'Microphone service idle.';
            };

            // Launch capture
            recognition.start();

        } catch (err) {
            console.error('Voice initialization failed:', err);
            successCallback(false, `Failed to initialize microphone: ${err.message}`);
        }
    } else {
        // Stop active capture
        if (recognition) {
            recognition.stop();
        }
        isRecording = false;
        micBtn.classList.remove('recording');
        statusLbl.textContent = 'Microphone service idle.';
    }
}
