const rateLimit = require('express-rate-limit');
module.exports = function createAuthLimiters() {
    const options = { windowMs:15*60*1000, standardHeaders:true, legacyHeaders:false };
    return {
        authLimiter: rateLimit({ ...options, max:5, skipSuccessfulRequests:true,
            message:{success:false,error:'Too many authentication attempts, please try again later.',retryAfter:900} }),
        googleChallengeLimiter: rateLimit({ ...options, max:30,
            message:{success:false,error:'Too many verification requests. Please try again later.',retryAfter:900} })
    };
};
