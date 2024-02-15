export const Wait = (ms: number) => new Promise((done) => setTimeout(done, ms));
export const vDist = (x1, y1, z1, x2, y2, z2) => {
    const deltaX = x2 - x1;
    const deltaY = y2 - y1;
    const deltaZ = z2 - z1;

    const distanceSquared = deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ;
    const distance = Math.sqrt(distanceSquared);
    
    return distance;
};