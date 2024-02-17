import { Handler } from './handlers';
import { HosepipeService } from './services/hosepipe';
import { RopeService } from './services/ropes';
import { Threads } from './threads';

const ropeService = new RopeService();
const hosepipeService = new HosepipeService(ropeService);

new Threads(hosepipeService, ropeService);
new Handler(hosepipeService, ropeService);