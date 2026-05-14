//@version=6
indicator("Alt Flow - Clean BUY SELL Volume Kick + H4 Confirm", overlay=true, max_labels_count=500, max_lines_count=500)

// ===== INPUT =====
volLen      = input.int(20, "Volume MA Length", minval=1)
volMultAvg  = input.float(1.2, "Volume > MA x", step=0.1)
volMultPrev = input.float(1.0, "Volume > Previous x", step=0.1)

volMode = input.string("1H vÃ  2H", "Äiá»u kiá»‡n volume", options=["1H hoáº·c 2H", "1H vÃ  2H"])

confirmedHTF      = input.bool(true, "Chá»‰ dÃ¹ng náº¿n HTF Ä‘Ã£ Ä‘Ã³ng, háº¡n cháº¿ repaint")
onceSignal        = input.bool(true, "Chá»‰ bÃ¡o 1 láº§n khi tÃ­n hiá»‡u má»›i xuáº¥t hiá»‡n")
needCloseConfirm  = input.bool(false, "YÃªu cáº§u H4 close vÆ°á»£t close H4 trÆ°á»›c")

showBg    = input.bool(false, "TÃ´ ná»n khi cÃ³ tÃ­n hiá»‡u")
showTable = input.bool(true, "Hiá»‡n báº£ng tráº¡ng thÃ¡i")

showTpSl  = input.bool(true, "Show TP/SL labels")
slLookback1h = input.int(8, "SL lookback 1H candles", minval=1)
rewardRisk = input.float(1.2, "TP:SL reward/risk", minval=0.1, step=0.1)

// ===== 1H DATA =====
vol1hConfirmed     = request.security(syminfo.tickerid, "60", volume[1], lookahead=barmerge.lookahead_off)
vol1hLive          = request.security(syminfo.tickerid, "60", volume, lookahead=barmerge.lookahead_off)

vol1hPrevConfirmed = request.security(syminfo.tickerid, "60", volume[2], lookahead=barmerge.lookahead_off)
vol1hPrevLive      = request.security(syminfo.tickerid, "60", volume[1], lookahead=barmerge.lookahead_off)

vol1hMAConfirmed   = request.security(syminfo.tickerid, "60", ta.sma(volume, volLen)[1], lookahead=barmerge.lookahead_off)
vol1hMALive        = request.security(syminfo.tickerid, "60", ta.sma(volume, volLen), lookahead=barmerge.lookahead_off)

high1hConfirmed    = request.security(syminfo.tickerid, "60", ta.highest(high, slLookback1h)[1], lookahead=barmerge.lookahead_off)
high1hLive         = request.security(syminfo.tickerid, "60", ta.highest(high, slLookback1h), lookahead=barmerge.lookahead_off)

low1hConfirmed     = request.security(syminfo.tickerid, "60", ta.lowest(low, slLookback1h)[1], lookahead=barmerge.lookahead_off)
low1hLive          = request.security(syminfo.tickerid, "60", ta.lowest(low, slLookback1h), lookahead=barmerge.lookahead_off)

float vol1h = na
float vol1hPrev = na
float vol1hMA = na
float high1h = na
float low1h = na

if confirmedHTF
    vol1h := vol1hConfirmed
    vol1hPrev := vol1hPrevConfirmed
    vol1hMA := vol1hMAConfirmed
    high1h := high1hConfirmed
    low1h := low1hConfirmed
else
    vol1h := vol1hLive
    vol1hPrev := vol1hPrevLive
    vol1hMA := vol1hMALive
    high1h := high1hLive
    low1h := low1hLive

// ===== 2H DATA =====
vol2hConfirmed     = request.security(syminfo.tickerid, "120", volume[1], lookahead=barmerge.lookahead_off)
vol2hLive          = request.security(syminfo.tickerid, "120", volume, lookahead=barmerge.lookahead_off)

vol2hPrevConfirmed = request.security(syminfo.tickerid, "120", volume[2], lookahead=barmerge.lookahead_off)
vol2hPrevLive      = request.security(syminfo.tickerid, "120", volume[1], lookahead=barmerge.lookahead_off)

vol2hMAConfirmed   = request.security(syminfo.tickerid, "120", ta.sma(volume, volLen)[1], lookahead=barmerge.lookahead_off)
vol2hMALive        = request.security(syminfo.tickerid, "120", ta.sma(volume, volLen), lookahead=barmerge.lookahead_off)

float vol2h = na
float vol2hPrev = na
float vol2hMA = na

if confirmedHTF
    vol2h := vol2hConfirmed
    vol2hPrev := vol2hPrevConfirmed
    vol2hMA := vol2hMAConfirmed
else
    vol2h := vol2hLive
    vol2hPrev := vol2hPrevLive
    vol2hMA := vol2hMALive

// ===== VOLUME KICK CONDITION =====
vol1hKick = not na(vol1hMA) and vol1h > vol1hMA * volMultAvg and vol1h > vol1hPrev * volMultPrev
vol2hKick = not na(vol2hMA) and vol2h > vol2hMA * volMultAvg and vol2h > vol2hPrev * volMultPrev

bool volumeKick = false

if volMode == "1H vÃ  2H"
    volumeKick := vol1hKick and vol2hKick
else
    volumeKick := vol1hKick or vol2hKick

// ===== H4 DATA =====
h4OpenConfirmed      = request.security(syminfo.tickerid, "240", open[1], lookahead=barmerge.lookahead_off)
h4OpenLive           = request.security(syminfo.tickerid, "240", open, lookahead=barmerge.lookahead_off)

h4CloseConfirmed     = request.security(syminfo.tickerid, "240", close[1], lookahead=barmerge.lookahead_off)
h4CloseLive          = request.security(syminfo.tickerid, "240", close, lookahead=barmerge.lookahead_off)

h4HighConfirmed      = request.security(syminfo.tickerid, "240", high[1], lookahead=barmerge.lookahead_off)
h4HighLive           = request.security(syminfo.tickerid, "240", high, lookahead=barmerge.lookahead_off)

h4LowConfirmed       = request.security(syminfo.tickerid, "240", low[1], lookahead=barmerge.lookahead_off)
h4LowLive            = request.security(syminfo.tickerid, "240", low, lookahead=barmerge.lookahead_off)

h4SwingHighConfirmed = request.security(syminfo.tickerid, "240", ta.highest(high, 3)[1], lookahead=barmerge.lookahead_off)
h4SwingHighLive      = request.security(syminfo.tickerid, "240", ta.highest(high, 3), lookahead=barmerge.lookahead_off)

h4SwingLowConfirmed  = request.security(syminfo.tickerid, "240", ta.lowest(low, 3)[1], lookahead=barmerge.lookahead_off)
h4SwingLowLive       = request.security(syminfo.tickerid, "240", ta.lowest(low, 3), lookahead=barmerge.lookahead_off)

h4PrevCloseConfirmed = request.security(syminfo.tickerid, "240", close[2], lookahead=barmerge.lookahead_off)
h4PrevCloseLive      = request.security(syminfo.tickerid, "240", close[1], lookahead=barmerge.lookahead_off)

float h4Open = na
float h4Close = na
float h4High = na
float h4Low = na
float h4SwingHigh = na
float h4SwingLow = na
float h4PrevClose = na

if confirmedHTF
    h4Open := h4OpenConfirmed
    h4Close := h4CloseConfirmed
    h4High := h4HighConfirmed
    h4Low := h4LowConfirmed
    h4SwingHigh := h4SwingHighConfirmed
    h4SwingLow := h4SwingLowConfirmed
    h4PrevClose := h4PrevCloseConfirmed
else
    h4Open := h4OpenLive
    h4Close := h4CloseLive
    h4High := h4HighLive
    h4Low := h4LowLive
    h4SwingHigh := h4SwingHighLive
    h4SwingLow := h4SwingLowLive
    h4PrevClose := h4PrevCloseLive

// ===== H4 CONFIRM =====
h4Green = h4Close > h4Open
h4Red   = h4Close < h4Open

bool buyConfirm = false
bool sellConfirm = false

if needCloseConfirm
    buyConfirm := h4Green and h4Close > h4PrevClose
    sellConfirm := h4Red and h4Close < h4PrevClose
else
    buyConfirm := h4Green
    sellConfirm := h4Red

// ===== BUY / SELL SIGNAL =====
buyRaw  = volumeKick and buyConfirm
sellRaw = volumeKick and sellConfirm

bool buySignal = false
bool sellSignal = false

if onceSignal
    buySignal := buyRaw and not buyRaw[1]
    sellSignal := sellRaw and not sellRaw[1]
else
    buySignal := buyRaw
    sellSignal := sellRaw

// ===== PLOT BUY / SELL ONLY =====
plotshape(
     buySignal,
     title="BUY Signal",
     style=shape.labelup,
     location=location.belowbar,
     color=color.lime,
     text="BUY",
     textcolor=color.white,
     size=size.normal
)

plotshape(
     sellSignal,
     title="SELL Signal",
     style=shape.labeldown,
     location=location.abovebar,
     color=color.red,
     text="SELL",
     textcolor=color.white,
     size=size.normal
)

// ===== TP / SL FROM NEAREST 1H HIGH-LOW =====
var float activeTp = na
var float activeSl = na
var string activeSide = "WAIT"

float signalTp = na
float signalSl = na

if buySignal
    signalSl := low1h
    float buyRisk = close - signalSl
    signalTp := buyRisk > 0 ? close + buyRisk * rewardRisk : na
    activeTp := signalTp
    activeSl := signalSl
    activeSide := "BUY"

if sellSignal
    signalSl := high1h
    float sellRisk = signalSl - close
    signalTp := sellRisk > 0 ? close - sellRisk * rewardRisk : na
    activeTp := signalTp
    activeSl := signalSl
    activeSide := "SELL"

if showTpSl and (buySignal or sellSignal) and not na(signalTp) and not na(signalSl)
    label.new(
         bar_index,
         signalTp,
         "● TP " + str.tostring(signalTp, format.mintick),
         style=label.style_label_down,
         color=color.new(color.green, 0),
         textcolor=color.white,
         size=size.small
    )

    label.new(
         bar_index,
         signalSl,
         "◆ SL " + str.tostring(signalSl, format.mintick),
         style=label.style_label_up,
         color=color.new(color.red, 0),
         textcolor=color.white,
         size=size.small
    )

    label.new(
         bar_index,
         signalTp,
         "●",
         style=label.style_none,
         textcolor=color.lime,
         size=size.large
    )

    label.new(
         bar_index,
         signalSl,
         "◆",
         style=label.style_none,
         textcolor=color.red,
         size=size.large
    )

plot(activeTp, title="Active TP", color=color.new(color.green, 100), display=display.none)
plot(activeSl, title="Active SL", color=color.new(color.red, 100), display=display.none)

// ===== BACKGROUND OPTIONAL =====
color bgCol = na

if showBg and buyRaw
    bgCol := color.new(color.green, 88)

if showBg and sellRaw
    bgCol := color.new(color.red, 88)

bgcolor(bgCol)

// ===== ALERT =====
alertcondition(buySignal, title="BUY - Alt Flow", message="BUY: Volume 1H/2H kick + H4 green confirm - {{ticker}}")
alertcondition(sellSignal, title="SELL - Alt Flow", message="SELL: Volume 1H/2H kick + H4 red confirm - {{ticker}}")

if buySignal and not na(signalTp) and not na(signalSl)
    alert("BUY: Volume 1H/2H kick + H4 green confirm - " + syminfo.ticker + " TP " + str.tostring(signalTp, format.mintick) + " SL " + str.tostring(signalSl, format.mintick), alert.freq_once_per_bar_close)

if sellSignal and not na(signalTp) and not na(signalSl)
    alert("SELL: Volume 1H/2H kick + H4 red confirm - " + syminfo.ticker + " TP " + str.tostring(signalTp, format.mintick) + " SL " + str.tostring(signalSl, format.mintick), alert.freq_once_per_bar_close)

// ===== STATUS TABLE =====
var table t = table.new(position.top_right, 2, 8, border_width=1)

string s1h = "NO"
string s2h = "NO"
string sVol = "NO"
string sH4 = "NEUTRAL"
string sSignal = "WAIT"
string sTP = "NA"
string sSL = "NA"

if vol1hKick
    s1h := "YES"

if vol2hKick
    s2h := "YES"

if volumeKick
    sVol := "YES"

if h4Green
    sH4 := "GREEN"

if h4Red
    sH4 := "RED"

if buyRaw
    sSignal := "BUY"

if sellRaw
    sSignal := "SELL"

if not na(activeTp)
    sTP := str.tostring(activeTp, format.mintick)

if not na(activeSl)
    sSL := str.tostring(activeSl, format.mintick)

if barstate.islast and showTable
    table.cell(t, 0, 0, "1H Vol Kick")
    table.cell(t, 1, 0, s1h)

    table.cell(t, 0, 1, "2H Vol Kick")
    table.cell(t, 1, 1, s2h)

    table.cell(t, 0, 2, "Volume OK")
    table.cell(t, 1, 2, sVol)

    table.cell(t, 0, 3, "H4 Candle")
    table.cell(t, 1, 3, sH4)

    table.cell(t, 0, 4, "Signal")
    table.cell(t, 1, 4, sSignal)

    table.cell(t, 0, 5, "Mode")
    table.cell(t, 1, 5, volMode)

    table.cell(t, 0, 6, "TP")
    table.cell(t, 1, 6, sTP)

    table.cell(t, 0, 7, "SL")
    table.cell(t, 1, 7, sSL)
