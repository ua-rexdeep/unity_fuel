import { Adapter } from '../server/vRPAdapter';
import { EventName, LoadModel } from '../utils';
import { Handler } from './handlers';
import { EntityService } from './services/entity';
import { HosepipeService } from './services/hosepipe';
import { JerryCanService } from './services/jerrycan';
import { RopeService } from './services/ropes';
import { UserInterface } from './services/userinterface';
import { VehicleService } from './services/vehicle';
import { Threads } from './threads';

const vRPclient = Adapter.getInterface('vRP');

const entityService = new EntityService(vRPclient as any);
const UIService = new UserInterface();
const ropeService = new RopeService();
const hosepipeService = new HosepipeService(ropeService, entityService);
const vehicleService = new VehicleService();
const jerryCanService = new JerryCanService();

new Threads(hosepipeService, ropeService, vehicleService, UIService, jerryCanService);
new Handler(hosepipeService, ropeService, vehicleService, UIService, jerryCanService);

emitNet(EventName('RequestClientConfig'));

let TestVehicle: number, TestNozzle: number;
RegisterCommand('fuel', async (_: number, __: [string], row: string) => {

    if(TestVehicle || GetVehiclePedIsIn(GetPlayerPed(-1), false)) DeleteEntity(TestVehicle || GetVehiclePedIsIn(GetPlayerPed(-1), false));
    
    for(const obj of GetGamePool('CObject')) {
        if(GetEntityModel(obj) == GetHashKey('prop_cs_fuel_nozle')) {
            SetEntityAsMissionEntity(obj, true, true);
            DeleteEntity(obj);
        }
    }

    // eslint-disable-next-line prefer-const
    let [,vehicleName, ox, oy, oz, , rx, ry, rz] = row.match(/fuel\s(\w+)(\s(\-*\d+[\.\-*\d+]*)\s*,\s*(\-*\d+[\.\-*\d+]*)\s*,\s*(\-*\d+[\.\-*\d+]*)(\s(\-*\d+[\.\-*\d+]*)\s*,\s*(\-*\d+[\.\-*\d+]*)\s*,\s*(\-*\d+[\.\-*\d+]*)|)|)/) as (string|number)[];

    if(ox) ox = parseFloat(ox as string);
    if(oy) oy = parseFloat(oy as string);
    if(oz) oz = parseFloat(oz as string);
    if(rx) rx = parseFloat(rx as string);
    if(ry) ry = parseFloat(ry as string);
    if(rz) rz = parseFloat(rz as string);

    const [px, py, pz] = GetEntityCoords(GetPlayerPed(-1));
    row = row.replace(`fuel ${vehicleName}`, '');
    
    if(row.length > 3) {
        [ox, oy, oz] = row.replace(`fuel ${vehicleName}`, '').split(',').map((v) => parseFloat(v.trim()));
        console.log('spawn', vehicleName, ox, oy, oz);
    }
    if(oz == undefined) {
        const offset = vehicleService.IndividualVehiclesConfig[GetHashKey(vehicleName.toString())]?.refillNozzleOffset;
        if(offset) {
            ox = offset.x;
            oy = offset.y;
            oz = offset.z;
        } else console.error(`No individual config for vehicle ${vehicleName}`);

    }
    if(rz == undefined) {
        const rotation = vehicleService.IndividualVehiclesConfig[GetHashKey(vehicleName.toString())]?.refillNozzleRotation;
        console.log(rotation);
        rx = (rotation?.x ?? -125.0);
        ry = (rotation?.y ?? -90.0);
        rz = (rotation?.z ?? -90.0);
    }
    await LoadModel(vehicleName.toString());
    TestVehicle = CreateVehicle(vehicleName, px, py, pz, GetEntityHeading(GetPlayerPed(-1)), false, true);
    TaskWarpPedIntoVehicle(GetPlayerPed(-1), TestVehicle, -1);
    await LoadModel('prop_cs_fuel_nozle');
    TestNozzle = CreateObject('prop_cs_fuel_nozle', px, py, pz, false, true, false);

    console.log('attach', ox as number, oy as number, oz as number, rx as number, ry as number, rz as number, );
    AttachEntityToEntity(TestNozzle, TestVehicle, 0, ox as number, oy as number, oz as number, rx as number, ry as number, rz as number, 
        true, true, true, 
        false, 1, true);

}, false);