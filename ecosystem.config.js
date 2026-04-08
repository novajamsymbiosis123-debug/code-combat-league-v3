// PM2 config — for VPS without Docker
// npm install -g pm2
// pm2 start ecosystem.config.js --env production
// pm2 save && pm2 startup
module.exports = {
  apps: [{
    name            : 'code-combat',
    script          : 'server.js',
    instances       : 1,
    exec_mode       : 'fork',
    watch           : false,
    max_memory_restart: '256M',
    env             : { NODE_ENV:'development', PORT:3000, CORS_ORIGIN:'*' },
    env_production  : { NODE_ENV:'production',  PORT:3000, CORS_ORIGIN:'https://your-domain.com' },
    log_date_format : 'YYYY-MM-DD HH:mm:ss Z',
    error_file      : './logs/error.log',
    out_file        : './logs/out.log',
    merge_logs      : true,
    autorestart     : true,
    restart_delay   : 3000,
    max_restarts    : 10,
  }],
};
