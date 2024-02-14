import '@citizenfx/client';
import { Wait } from '../utils';

setTick(async () => {
    await Wait(1000);

    console.log('Wait');
});