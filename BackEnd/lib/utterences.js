function greeting() { 
    return `Hello! How are you doing?`; 
}

function ack() {
    return "Thanks — I heard you. Let me think..."; 
}

function permission() { 
    return "Thank you for joining. May I begin the interviw now?"; 
}

function askQuestion(text) { 
    return text; 
}

const uttererences = {
    greeting,
    ack,
    permission,
    askQuestion,
}

export default uttererences;