import * as server from './src/server';

server.start().catch((err) => {
    console.log('Application Server Error');
    console.error(err);
    process.exit(1);
})
