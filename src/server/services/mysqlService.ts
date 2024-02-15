export class MySQLService {
    constructor(){}

    Command<Q = void, R = void>(query: string) {
        return (variables: Q) => new Promise((done: (rows: R) => void) => {
            global.exports['ghmattimysql'].execute(query, variables, done);
        });
    }

    async IsTableExists(table_name: string) {
        const [{ table_exists }] = await this.Command<{ table_name: string }, [{ table_exists: number }]>(`SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_name = @table_name
        ) AS table_exists;`)({ table_name });

        return table_exists == 1;
    }
}