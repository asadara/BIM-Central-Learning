const session = require('express-session');
class AdminSessionStore extends session.Store {
    constructor(pool) { super(); this.pool=pool; }
    get(sid,callback) {
        this.pool.query('SELECT sess FROM bcl_admin_sessions WHERE sid=$1 AND expires_at>now()',[sid])
            .then(r=>callback(null,r.rows[0]?.sess||null),callback);
    }
    set(sid,sess,callback=()=>{}) {
        const expires=sess.cookie?.expires||new Date(Date.now()+30*60*1000);
        this.pool.query(`INSERT INTO bcl_admin_sessions(sid,sess,expires_at) VALUES($1,$2,$3)
            ON CONFLICT(sid) DO UPDATE SET sess=EXCLUDED.sess,expires_at=EXCLUDED.expires_at`,[sid,JSON.stringify(sess),expires])
            .then(()=>callback(),callback);
    }
    touch(sid,sess,callback=()=>{}) {
        this.pool.query('UPDATE bcl_admin_sessions SET expires_at=$2 WHERE sid=$1',[sid,sess.cookie.expires])
            .then(()=>callback(),callback);
    }
    destroy(sid,callback=()=>{}) { this.pool.query('DELETE FROM bcl_admin_sessions WHERE sid=$1',[sid]).then(()=>callback(),callback); }
}
module.exports=AdminSessionStore;
