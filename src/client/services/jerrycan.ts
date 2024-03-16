export type JerryCanData = { petrol?: number, solvent?: number };
export class JerryCanService {
    private jerryCanData: JerryCanData = {};

    UpdateData(data: JerryCanData) {
        this.jerryCanData = data;
    }

    GetData(){
        return this.jerryCanData;
    }

    GetContentAmount() {
        return (this.jerryCanData.petrol || 0) + (this.jerryCanData.solvent || 0);
    }

    // calls each 100ms ticks, when player fire jerry can with 500ms delay
    OnWeaponFire() {
        if(this.GetContentAmount() == 0) return false;
        // const contents = ['solvent', 'petrol'].filter((k) => this.jerryCanData[k] > 0); // рандомний вибір, що буде виливатись
        // const nextContent = contents[(Math.random()*(contents.length + 1) - 1)|0];
        const nextContent = this.jerryCanData.petrol ? 'petrol' : 'solvent';
        console.log(this.jerryCanData.petrol, this.jerryCanData.solvent, nextContent, this.jerryCanData[nextContent]);
        if(nextContent in this.jerryCanData && this.jerryCanData[nextContent]! > 0) this.jerryCanData[nextContent]! -= 0.01;

        if(this.jerryCanData.petrol != null && this.jerryCanData.petrol <= 0) delete this.jerryCanData.petrol;
        if(this.jerryCanData.solvent != null && this.jerryCanData.solvent <= 0) delete this.jerryCanData.solvent;
        return { content: nextContent, value: 0.01 };
    }
}