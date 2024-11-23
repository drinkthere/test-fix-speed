const fs = require("fs");

{
    let { file } = require("minimist")(process.argv.slice(2));

    // 读取文件内容
    let data = fs.readFileSync(file, "utf-8").trim().split("\n");
    // 将内容拆分成行
    let lines = data.map((line) => {
        if (line.includes("SPEED")) {
            return line.split(" ");
        }
    });

    let result = {};

    for (let line of lines) {
        if (!line) {
            continue;
        }
        let orderId = line[2];
        let event = line[3];
        let ts = parseInt(line[line.length - 1]);

        let item = {
            orderId: orderId,
        };
        if (orderId in result) {
            item = result[orderId];
        }

        // 赋值时间
        if (event == "NEWSUBMIT") {
            item.t1s = ts;
        } else if (event == "NEWSUBMITTED") {
            item.t1e = ts;
        } else if (event == "CANCELSUBMIT") {
            item.t2s = ts;
        } else if (event == "CANCELSUBMITTED") {
            item.t2e = ts;
        } else if (event == "CBNEW") {
            item.t1cb = ts;
        } else if (event == "CBCANCELED") {
            item.t2cb = ts;
        }

        result[orderId] = item;
    }

    // 计算时间差
    for (let orderId in result) {
        let item = result[orderId];
        if (item.t1s && item.t1cb) {
            item.t1cbct = item.t1cb - item.t1s;
        }

        if (item.t2s && item.t2cb) {
            item.t2cbct = item.t2cb - item.t2s;
        }
    }

    // 汇总计算
    let totalCount = 0;
    let sumPlaceWsCost = 0;
    let sumPlaceCallbackCost = 0;
    let sumCancelWsCost = 0;
    let sumCancelCallbackCost = 0;

    for (let orderId in result) {
        let item = result[orderId];
        if (!item.t1cbct || !item.t2cbct) {
            continue;
        }
        totalCount += 1;
        sumPlaceCallbackCost += item.t1cbct;
        sumCancelWsCost += item.t2rct;
        sumCancelCallbackCost += item.t2cbct;
    }

    let avgPlaceCallbackCost =
        parseInt((sumPlaceCallbackCost / totalCount) * 1000) / 1000;
    let avgCancelCallbackCost =
        parseInt((sumCancelCallbackCost / totalCount) * 1000) / 1000;

    console.log(`totalCount=${totalCount}`);
    console.log(
        `sumPlaceCallbackCost=${sumPlaceCallbackCost} sumCancelCallbackCost=${sumCancelCallbackCost}`
    );
    console.log(
        `avgPlaceCallbackCost=${avgPlaceCallbackCost} avgCancelCallbackCost=${avgCancelCallbackCost}`
    );
}
