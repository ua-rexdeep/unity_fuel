export const Wait = (ms: number) => new Promise((done) => setTimeout(done, ms));
export const vDist = (x1, y1, z1, x2, y2, z2) => {
    const deltaX = x2 - x1;
    const deltaY = y2 - y1;
    const deltaZ = z2 - z1;

    const distanceSquared = deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ;
    const distance = Math.sqrt(distanceSquared);
    
    return distance;
};
export const LoadRopeTextures = async () => {
    RopeLoadTextures();
    while(!RopeAreTexturesLoaded()) await Wait(10);
    RopeLoadTextures();
};
export const LoadModel = async (modelName: string) => {
    if(!IsModelValid(modelName)) throw new Error(`Model '${modelName}' is not valid`);
    RequestModel(modelName);
    while(!HasModelLoaded(modelName)) await Wait(10);
    return modelName;
};
export const EventName = (suffix: string) => `UnityFuel::${suffix}`;
export function DrawText3D(x, y, z, text, r = 255, g = 255, b = 255) {   
    const [onScreen, _x, _y] = World3dToScreen2d(x, y, z);
    if(onScreen){
        SetTextScale(0.25, 0.25);
        SetTextFont(0);
        SetTextColour(r, g, b, 255);
        SetTextOutline();
        SetTextEntry('STRING');
        SetTextCentre(true);
        AddTextComponentString(text);
        DrawText(_x, _y);
    }
}