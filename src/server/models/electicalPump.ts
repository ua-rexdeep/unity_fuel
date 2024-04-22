import { FuelEssenceService } from '../services/fuelEssenceService';
import { FuelStationService } from '../services/fuelStationService';
import { MySQLService } from '../services/mysqlService';
import { PlayerService } from '../services/playerService';
import { FuelPump, IFuelPump } from './fuelPump';
import { FuelStation } from './station';

export class ElecticalPump extends FuelPump {
    private houseId: number | null;

    constructor(
        service: FuelStationService,
        playerService: PlayerService,
        station: FuelStation | null,
        public readonly brandName: string,
        MySQL: MySQLService,
        essence: FuelEssenceService,
        initData: IFuelPump,
    ) {
        super(service, playerService, station, brandName, MySQL, essence, initData);
        this.houseId = initData.houseId;
    }

    IsElectric(): boolean {
        return true;
    }

    SetHouseId(houseId: number | null) {
        this.houseId = houseId;
    }

    async Save() {
        const pump = await this.MySQL.FetchFuelPumpById(this.id);
        if (pump.length == 0) { // create
            return this.MySQL.InsertElectricPump({
                defaultRotation: this.defaultRotation,
                id: this.id,
                stationId: this.station?.id || null,
                x: this.worldCoords.x,
                y: this.worldCoords.y,
                z: this.worldCoords.z,
                number: this.number,
                houseId: this.houseId,
            });
        } else {
            return this.MySQL.UpdateFuelStationPump(this.id, {
                broken: this.hosepipes.some((hosepipe) => hosepipe?.IsBroken()),
            });
        }
    }
}