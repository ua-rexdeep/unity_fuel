export class UserInterface {
    
    private _nozzleCurrentState = false;

    private NUI(type: 'update', data: { fuelCost: string, fuelTank: string }): void
    private NUI(type: 'warn', data: Record<string, never>): void;
    private NUI(type: 'status', data: { status: boolean }): void;
    private NUI(type: string, data: Record<string, any>): void {
        console.log(JSON.stringify({ type, ...(data || {}) }));
        SendNUIMessage({ type, ...(data || {}) });
    }

    ShowNozzleDisplay() {
        if(this._nozzleCurrentState == true) return;
        this.NUI('status', { status: true });
        this._nozzleCurrentState = true;
    }

    HideNozzleDisplay() {
        if(this._nozzleCurrentState == false) return;
        this.NUI('status', { status: false });
        this._nozzleCurrentState = false;
    }

    WarnNozzleDisplay() {
        this.NUI('warn', {});
    }

    UpdateNozzleDisplay(fuelCost: string, fuelTank: string) {
        this.NUI('update', { fuelCost, fuelTank });
    }

    ShowNotification(text: string) {
        SetNotificationTextEntry('STRING');
        AddTextComponentString(text);
        DrawNotification(false, false);
    }
}