import WebSocket from "ws";


const SYMBOLS: string[] = ["btcusdt", "ethusdt", "solusdt", "bnbusdt"];
const symbols = SYMBOLS.map((s) => `${s}@trade`).join("/");
const url: string = `wss://stream.binance.com:9443/stream?streams=${symbols}`;

const binanceSocket = new WebSocket(url)

binanceSocket.on("open", () : void => {
    console.log("Connected to Binance WebSocket");
});

binanceSocket.on("message", async (raw : any) : Promise<void> => {
    const msg =JSON.parse(raw.toString());

    console.log(msg);
});

binanceSocket.on("error", (error : Error): void => {
    console.error("Binance websocket error : ", error);
});

binanceSocket.on("close", () : void =>{
    console.log("Binance websocket connection closed");
});

 console.log("Applicarion started -- fetching trade data");