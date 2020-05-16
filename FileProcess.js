/**
 * 该js文件包装了绘制原始回波，后散射系数数据，散射消光系数的绘图
 * 包含数据解析，绘图等等
 */
import buffer from './buffer'
import $http from './httpRequest'
import {formatDateTime} from './index'
import ycharts from '../cdyw-libs/ycharts/ycharts'

export default class FileProcess {
  allData = [];
  length = 50;
  range = []; // 色标范围
  chartArr = [];
  callback = {};
  chanel = null;
  timeSheet = [] // 形成一个24小时的时间表, 用于查表
  constructor () {
    this.getTimeSheet()
  }
  getTimeSheet () {
    let len = 24 * 60 // 按1分钟算
    for (let i = 0; i < len; i++) {
      let val = i === len - 1 ? ((i + 1) * 60 - 1) : i * 60 // 最后一个时间为23:59:59
      this.timeSheet.push(val) // 秒
    }
  }
  loadFile (type, fileList, callback) {
    console.log(type)
    this.allData = []
    // if (fileList.length === 0) {
    //   this.clear()
    // }
    this.length = fileList.length
    if (type === 10) { // 原始回波
      this.myprocessTHI(type, fileList, callback) // 后台小时文件
      // this.processTHI2(type, fileList, callback) // 本地小时文件 测试
      // this.processTHI3(type, fileList, callback) // 本地分钟文件 测试
    } else if (type === 20 || type === 21 || type === 23) { // 后向散射系数355
      this.processBAKSACT(type, fileList, callback) // 后台小时文件
      // this.processBAKSACT2(type, fileList, callback) // 本地小时文件
      // this.processBAKSACT3(type, fileList, callback) // 本地分钟文件
    } else if (type === 30 || type === 31 || type === 33) { // 散射消光系数
      this.processBAKSACT(type, fileList, callback) // 后台小时文件
      // this.processBAKSACT2(type, fileList, callback) // 本地小时文件
      // this.processBAKSACT3(type, fileList, callback) // 本地分钟文件
    } else if (type === 40 || type === 41) { // 后向散射系数 和 消光系数

    } else if (type === 50) { // 退偏比

    }
  }
  myprocessTHI (type, fileList, callback) {
    let count = 0
    let hourData = []
    let t1 = new Date()
    let i = 0
    while (i < this.length) {
      let url = $http.adornUrl(`/prod/getFileByName?fileName=${fileList[i].fileName}`)
      buffer.load(url, resp => {
        let minData = []
        let minLen = buffer.getValueFromTypedArray(buffer.getArrFromBuffer(resp, 0, 'Int8', 1), 'int') // 分钟文件的长度
        for (let j = 0; j < minLen; j++) {
          let byteLength = 0
          if (j !== 0) {
            byteLength = minData[j - 1].byteLength
          }
          let data = {}
          data.station = buffer.getValueFromTypedArray(buffer.getArrFromBuffer(resp, 18 + byteLength, 'Uint32', 1)) // 区站号
          data.st = buffer.getValueFromTypedArray(buffer.getArrFromBuffer(resp, 32 + byteLength, 'Uint32', 1)) // 径向数据收集开始时间(秒,自00:00开始)
          data.et = buffer.getValueFromTypedArray(buffer.getArrFromBuffer(resp, 36 + byteLength, 'Uint32', 1)) // 径向数据收集结束时间(秒,自00:00开始)
          data.day = buffer.getValueFromTypedArray(buffer.getArrFromBuffer(resp, 40 + byteLength, 'Uint16', 1)) // 自1970年1月1日开始，每增加1天，计数增加1
          data.chanel = buffer.getValueFromTypedArray(buffer.getArrFromBuffer(resp, 52 + byteLength, 'Uint16', 1)) // 接收通道数（使用licel采集卡，最大可以达到16通道）
          this.chanel = data.chanel
          let day = new Date(1970, 0, 1, 0, 0, 0).getTime() / 1000 + data.day * 24 * 60 * 60
          data.startTime = data.st + day
          data.endTime = data.et + day
          // console.log(formatDateTime(data.endTime * 1000, 'time'))
          data.endTimeFormate = formatDateTime(data.endTime * 1000, 'time')
          for (let m = 0; m < data.chanel; m++) { // 根据通道数获取各通道数据
            let type = '通道' + buffer.getValueFromTypedArray(buffer.getArrFromBuffer(resp, 54 + byteLength + m * 16, 'Uint16', 1)) // 获取通道名字
            data['chanelConfig' + m] = getChanelConfig(type, resp, m, byteLength) // 通道数据
            data['chanelConfig' + m]['data' + 2] = this.calcTHIData(data['chanelConfig' + m])
          }
          // console.log(data)
          data.colorFile = 'clrTHI.clr'
          data.binLen = 0
          for (let n = 0; n < data.chanel; n++) {
            data.binLen += buffer.getValueFromTypedArray(buffer.getArrFromBuffer(resp, 68 + byteLength + 16 * n, 'Uint16', 1)) // 通道距离库数
          }
          data.byteLength = byteLength + 54 + 16 * data.chanel + data.binLen * 4
          minData.push(data)
        }
        hourData.push(minData)
        count++
        if (count === this.length) {
          hourData.sort((a, b) => {
            return a[0].endTime - b[0].endTime
          })
          console.log(hourData)
          for (let a = 0; a < this.chanel; a++) {
            let data = []
            for (let m = 0; m < hourData.length; m++) {
              for (let k = 0; k < hourData[m].length; k++) {
                data.push(hourData[m][k])
              }
            }
            this.allData.push(data)
          }
          console.log('文件读取和解析时间：', new Date() - t1)
          if (callback && typeof callback === 'function') {
            callback(this.allData)
          }
        }
      }, 'arraybuffer')
      i++
    }
    // if (this.length === 0) {
    //   this.setDefaultChart('0')
    // }
    function getChanelConfig (name, resp, n, byteLen) {
      let config = {
        name: name,
        type: buffer.getValueFromTypedArray(buffer.getArrFromBuffer(resp, 58 + byteLen + 16 * n, 'Uint16', 1)), // 回波信号类型，0：非偏振；1：偏振P；2：偏振S； 3：拉曼
        rangeResolution: buffer.getValueFromTypedArray(buffer.getArrFromBuffer(resp, 60 + byteLen + 16 * n, 'Uint16', 1)), // 距离分辨率
        blind: buffer.getValueFromTypedArray(buffer.getArrFromBuffer(resp, 62 + byteLen + 16 * n, 'Uint16', 1)), // 盲区高度（单位m）
        binNum: buffer.getValueFromTypedArray(buffer.getArrFromBuffer(resp, 68 + byteLen + 16 * n, 'Uint16', 1)) // 通道距离库数
      }
      config.data = Array.from(buffer.getArrFromBuffer(resp, 70 + byteLen + config.binNum * 4 * n, 'Float32', config.binNum)) // 通道数据
      return config
    }
  }
  /**
   * 向后散射系数数据解析 散射消光系数数据解析
   * @param type
   * @param fileList
   * @param callback
   */
  processBAKSACT (type, fileList, callback) {
    let count = 0
    let hourData = []
    // console.log(fileList)
    let i = 0
    while (i < this.length) {
      let url = $http.adornUrl(`/prod/getFileByName?fileName=${fileList[i].fileName}`)
      buffer.load(url, resp => {
        let minData = []
        let minLen = buffer.getValueFromTypedArray(buffer.getArrFromBuffer(resp, 0, 'Int8', 1), 'int') // 分钟文件的长度
        for (let j = 0; j < minLen; j++) {
          let byteLength = 0
          if (j !== 0) {
            byteLength = minData[j - 1].byteLength
          }
          let data = {}
          data.station = buffer.getValueFromTypedArray(buffer.getArrFromBuffer(resp, 18 + byteLength, 'Uint32', 1)) // 区站号
          data.st = buffer.getValueFromTypedArray(buffer.getArrFromBuffer(resp, 32 + byteLength, 'Uint32', 1)) // 径向数据收集开始时间(秒,自00:00开始)
          data.et = buffer.getValueFromTypedArray(buffer.getArrFromBuffer(resp, 36 + byteLength, 'Uint32', 1)) // 径向数据收集结束时间(秒,自00:00开始)
          data.day = buffer.getValueFromTypedArray(buffer.getArrFromBuffer(resp, 40 + byteLength, 'Uint16', 1)) // 自1970年1月1日开始，每增加1天，计数增加1
          data.binNum = buffer.getValueFromTypedArray(buffer.getArrFromBuffer(resp, 48 + byteLength, 'Uint16', 1))
          let day = new Date(1970, 0, 1, 0, 0, 0).getTime() / 1000 + data.day * 24 * 60 * 60
          data.startTime = data.st + day
          data.endTime = data.et + day
          // console.log(buffer.getValueFromTypedArray(buffer.getArrFromBuffer(resp, 44 + byteLength, 'Uint16', 1)))
          data.nameWave = '波长' + buffer.getValueFromTypedArray(buffer.getArrFromBuffer(resp, 44 + byteLength, 'Uint16', 1))
          if (type === 20 || type === 30) { // type = 20 后向散射系数  type = 30 消光系数
            data.chanelConfig0 = getChannelConfig(data.nameWave, resp, byteLength)
            data.chanelConfig0.data2 = this.calcBAKSACTData(data.chanelConfig0)
            data.colorFile = type === 20 ? 'clrMBAKSCAT-335.clr' : 'clrMEXT-335.clr'
          } else if (type === 21 || type === 31) {
            data.chanelConfig0 = getChannelConfig(data.nameWave, resp, byteLength, data.binNum)
            data.chanelConfig0.data2 = this.calcBAKSACTData(data.chanelConfig0)
            data.colorFile = type === 21 ? 'clrMBAKSCAT-532.clr' : 'clrMEXT-532.clr'
          } else if (type === 23 || type === 33) {
            data.chanelConfig2 = getChannelConfig(data.nameWave, resp, byteLength, data.binNum)
            data.chanelConfig2.data2 = this.calcBAKSACTData(data.chanelConfig2)
            data.colorFile = type === 23 ? 'clrMBAKSCAT-1064.clr' : 'clrMEXT-1064.clr'
          }
          data.byteLength = byteLength + 50 + data.binNum * 4
          minData.push(data)
          console.log(data)
        }
        hourData.push(minData)
        count++
        if (count === this.length) {
          // 所有数据解析完成
          hourData.sort((a, b) => {
            return a[0].endTime - b[0].endTime
          })
          let data = []
          for (let m = 0; m < hourData.length; m++) {
            for (let k = 0; k < hourData[m].length; k++) {
              data.push(hourData[m][k])
            }
          }
          this.allData.push(data)
          console.log(this.allData)
          this.length = this.allData.length
          if (callback && typeof callback === 'function') {
            callback(this.allData)
          }
        }
      }, 'arraybuffer')
      i++
    }
    if (this.length === 0) {
      this.setDefaultChart('0')
    }
    function getChannelConfig (name, resp, byteLen, binNum) {
      let config = {
        name: name,
        rangeResolution: buffer.getValueFromTypedArray(buffer.getArrFromBuffer(resp, 28 + byteLen, 'Uint16', 1)), // 距离分辨率
        blind: 0// 盲区高度（单位m）
        // binNum: buffer.getValueFromTypedArray(buffer.getArrFromBuffer(resp, 68 + 16 * 2, 'Uint16', 1)), // 通道距离库数
      }
      config.data = Array.from(buffer.getArrFromBuffer(resp, 50 + byteLen, 'Float32', binNum)) // 通道数据
      return config
    }
  }
  // 本地小时文件
  calcTHIData (chanelConfig) {
    let arr = []
    let n = 0
    let length = chanelConfig.data.length
    while (n < length) {
      let t = Number(chanelConfig.data[n]) * (n * chanelConfig.rangeResolution / 100 * n * chanelConfig.rangeResolution / 100)
      // console.log(Math.log10(t) * 10, data.data[n], n)
      let log = t > 0 ? Math.log10(t) : 0
      arr.push(log)
      n++
    }
    this.range = [5, 8]
    return arr
  }
  calcBAKSACTData (chanelConfig) {
    let arr = []
    let n = 0
    let length = chanelConfig.data.length
    while (n < length) {
      let t = Number(chanelConfig.data[n])
      // console.log(Math.log10(t) * 10, data.data[n], n)
      t = t > 0 ? Math.log10(t) : 0
      if (!isNaN(t)) {
        arr.push(t)
      }
      n++
    }
    return arr
  }
  initDay (time) {
    let day = new Date(time)
    let hours = []
    let i = 0
    while (i < 1440) { // 24 * 60
      day.setHours(0, 0, 0, 0)
      day.setMinutes(i, 0, 0)
      let h = formatDateTime(day.getTime(), 'minute').split(' ')[1]
      hours.push(h)
      i++
    }
    // console.log(hours)
    return hours
  }
  setDefaultChart (id) {
    console.log()
    let dom = document.getElementById('chart' + id)
    this.options = {
      xAxis: {
        type: 'category',
        name: '时间',
        axisLabel: {
          num: 13
        },
        data: this.initDay(new Date().getTime())
      },
      yAxis: {
        type: 'category',
        name: '高度(km)',
        axisLabel: {
          num: 7
        },
        data: []
      },
      series: [
        {
          type: 'heatMap',
          data: []
        }
      ]
    }
    if (dom) {
      ycharts.dispose(dom)
    }
    console.log(this.chartArr)
    this.chartArr[id] = ycharts.init(dom)
    this.chartArr[id].setOption(this.options)
    this.chartArr[id].resize()
    console.log(this.chartArr)
  }
  setChart (id, param) {
    console.log('^^^^^^^^^^^^')
    let dom = document.getElementById('chart' + id)
    this.options = {
      title: {
        text: param[0]['chanelConfig' + id].name
      },
      colorPatch: {
        url: window.SITE_CONFIG.cdnUrl + '/static/clr/' + param[0].colorFile,
        width: 60,
        height: 120
      },
      grid: {
        top: 30,
        left: 50,
        right: 80,
        bottom: 20
      },
      xAxis: {
        type: 'category',
        name: '时间',
        axisLabel: {
          num: 13
        },
        data: this.initDay(new Date().getTime())
      },
      yAxis: {
        type: 'category',
        name: '高度(km)',
        axisLabel: {
          num: 6
        },
        data: []
      },
      series: [
        {
          type: 'heatMap',
          data: []
        }
      ]
    }
    let data = param
    // console.log(data)
    // ------ 无数据的时间点空白，固定24小时 ------------
    let m = 0
    let len = this.timeSheet.length
    let xData = []
    let t1 = new Date()
    while (m < len) {
      xData[m] = null
      for (let i = 0; i < data.length; i++) {
        if (m < len - 2) {
          if (data[i].et >= this.timeSheet[m] && data[i].et < this.timeSheet[m + 2]) { // 相当于2分钟内有文件都能存储
            xData[m] = data[i].et
            this.getSeries(data[i], id, m, i)
            break
          }
        } else {
          if (data[i].et > this.timeSheet[m - 2] && data[i].et <= this.timeSheet[m]) {
            xData[m] = data[i].et
            // console.log(data[i].et, m, this.timeSheet[m])
            this.getSeries(data[i], id, m, i)
          }
        }
      }
      m++
    }
    console.log('组合数据时间:', new Date() - t1)
    // console.log(data, xData)
    // -------- 无数据的时间点不留空白 -----------------
    // this.options.xAxis.data = []
    // for (let i = 0; i < data.length; i++) {
    //   let day = new Date(1970, 0, 1, 0, 0, 0).getTime() / 1000 + data[i].day * 24 * 60 * 60
    //   data[i].startTime = data[i].st + day
    //   data[i].endTime = data[i].et + day
    //   let time = formatDateTime((data[i].et + day) * 1000, 'time')
    //   this.options.xAxis.data.push(time.split(' ')[1])
    //   this.getSeries(data[i], id, i, i)
    // }

    if (dom) {
      ycharts.dispose(dom)
    }
    dom.innerHTML = ''
    this.chartArr[id] = ycharts.init(dom)
    this.chartArr[id].setOption(this.options)
    this.chartArr[id].resize()
    this.chartArr[id].on('mousemove', (param) => {
      if (this.callback['mousemove']) this.callback['mousemove'](param)
    })
  }
  getSeries (data, id, x, i) {
    let day = new Date(1970, 0, 1, 0, 0, 0).getTime() / 1000 + data.day * 24 * 60 * 60
    data.startTime = data.st + day
    data.endTime = data.et + day
    let time = formatDateTime((data.et + day) * 1000, 'time')
    // this.options.xAxis.data.push(time.split(' ')[1])
    // console.log(time, data.st, data.et)
    // console.log(data, 'data')
    let chanelConfig = data['chanelConfig' + id]
    let rangeResolution = chanelConfig.rangeResolution / 100
    let boo = false
    if (this.options.yAxis.data.length === 0) boo = true
    let len = 12000 / rangeResolution + 1
    for (let y = 0; y < len; y++) {
      if (boo) {
        let h = 0
        h = Number(y * rangeResolution / 1000).toFixed(3)
        this.options.yAxis.data.push(h)
      }
      // console.log(Number(this.allData[i].log10[j]))
      let d = Number(data['chanelConfig' + id].data2[y])
      let key = `${x}-${y}`
      // this.options.series[0].data.push([i, j, d])
      let tip = {
        '-': data['chanelConfig' + id].name,
        '时间': time,
        '高度': this.options.yAxis.data[y] + 'km',
        '值': d,
        '时间索引': i
      }
      this.options.series[0].data[key] = {value: d, tip: tip, series: data['chanelConfig' + id].data2, index: i}
    }
  }
  on (type, callback) {
    if (callback && typeof callback === 'function') {
      this.callback[type] = callback
    }
  }
  off (type) {
    if (this.callback[type]) this.callback[type] = null
  }
  clear () {
    console.log(this.chartArr)
    for (let i = 0; i < this.chartArr.length; i++) {
      if (this.chartArr[i]) {
        this.chartArr[i].clear()
      }
    }
    this.allData = []
  }
  resize () {
    console.log(this.chartArr)
    for (let i = 0; i < this.chartArr.length; i++) {
      if (this.chartArr[i]) {
        this.chartArr[i].resize()
      }
    }
  }
}
