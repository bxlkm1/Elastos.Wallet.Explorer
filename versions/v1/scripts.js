$(document).ajaxStart(function() {
  $("#loader").show();
});

function get_address() {
  var address = document.getElementById("address").value;
  console.log(address)

  $.get("https://cors-anywhere.herokuapp.com/https://node1.elaphant.app/api/1/dpos/address/" + address + "?pageSize=1&pageNum=1", function(data){
      get_pay_addresses(data,address)
  });

  function get_pay_addresses(data,address) {
  $.get({
    url: "https://cors-anywhere.herokuapp.com/https://elanodes.com/api/payout-addresses?87568",
    cache: false
  }).then(function(pay_object){
    pay_object = JSON.parse(pay_object)
    scan_vote_history(data,address,pay_object)
    });
  }
}

function scan_vote_history(data,address,pay_object) {

  document.getElementById("loading_message").innerHTML = "Analyzing transactions..."

  var node_names = []
  var inactives = []
  var pay_addresses = {
    result:[]
  }

  var block_time = parseInt(data.result[0].Vote_Header.Block_time)*1000
  var date = new Date(block_time)
  document.getElementById("last_vote").innerHTML = date

  var value = parseFloat(data.result[0].Vote_Header.Value)
  document.getElementById("balance").innerHTML = value.toLocaleString(undefined, {maximumFractionDigits:2})

  var node_num = data.result[0].Vote_Header.Node_num
  document.getElementById("node_num").innerHTML = node_num

  for (i=0; i < data.result[0].Vote_Body.length; i++) {
    node = data.result[0].Vote_Body[i].Producer_public_key

    node_names.push(data.result[0].Vote_Body[i].Nickname)

    var match = _.find(pay_object.result, function(votedNode){ return votedNode.Producer_public_key == node});

    // Add logic for inactive nodes here

    //console.log(match)

    if (match !== undefined) {
      pay_addresses.result.push(match)
    } else {
      node_names.pop(data.result[0].Vote_Body[i].Nickname)
      inactives.push(data.result[0].Vote_Body[i].Nickname)
    }
  }

  ul = document.createElement('ul')
  document.getElementById("nodes").appendChild(ul)

  inactives.forEach(function (node) {
    let li = document.createElement('li');
    ul.appendChild(li);
    li.innerHTML += node + ' -- Alert: Node Canceled';
    li.style.color = "#e8007f";
  });

  node_names.forEach(function (node) {
    let li = document.createElement('li');
    ul.appendChild(li);
    li.innerHTML += node;
  });

  $.get("https://cors-anywhere.herokuapp.com/https://node1.elaphant.app/api/1/history/" + address, function(data){
      console.log('Raw address history data')
      //data = JSON.parse(data) // Uncomment if using local node
      console.log(data)
      scan_address_history(data,address,pay_object,pay_object,value,block_time)
  })


}


function scan_address_history(data,address,pay_object,pay_addresses,value,block_time) {

  var payments = {
    data: []
  }

  var misc = {
    data: []
  }

  var votes = []
  //console.log(data.result.History.length + ' transactions on record')


  for (i = data.result.History.length - 1; i > -1; i--) {

    var transaction = data.result.History[i]
    //console.log(transaction)

    //if (transaction.TxType === "TransferAsset") {
      var send_address = transaction.Inputs

      // NEED TO ADD ELALLIANCE PAYOUT ADDRESS SO IT CAN MATCH. Address added to all 96 nodes right now

      var match0 = _.find(pay_addresses.result, function(payment){ return payment.Payout_wallet[0] == send_address});
      var match1 = _.find(pay_addresses.result, function(payment){ return payment.Payout_wallet[1] == send_address});
      var match2 = _.find(pay_addresses.result, function(payment){ return payment.Payout_wallet[2] == send_address});

    var entry = {}

    if (match0 !== undefined) {

      entry.time = transaction.CreateTime
      entry.from_name = match0.Nickname
      entry.value = transaction.Value/100000000
      entry.hash = transaction.Txid
      //entry.from_key = match0.Producer_public_key
      //entry.from_address = transaction.Inputs[0]
      //entry.block = transaction.Height
      //entry.tx_id = transaction.Txid
      //entry.fee = transaction.Fee

      payments.data.push(entry)

    } else if (match1 !== undefined) {

      entry.time = transaction.CreateTime
      entry.from_name = match1.Nickname
      entry.value = transaction.Value/100000000
      entry.hash = transaction.Txid
      //entry.from_key = match1.Producer_public_key
      //entry.from_address = transaction.Inputs[0]
      //entry.block = transaction.Height
      //entry.tx_id = transaction.Txid
      //entry.fee = transaction.Fee

      payments.data.push(entry)

    } else if (match2 !== undefined) {

      entry.time = transaction.CreateTime
      entry.from_name = match2.Nickname
      entry.value = transaction.Value/100000000
      entry.hash = transaction.Txid
      //entry.from_key = match2.Producer_public_key
      //entry.from_address = transaction.Inputs[0]
      //entry.block = transaction.Height
      //entry.tx_id = transaction.Txid
      //entry.fee = transaction.Fee

      payments.data.push(entry)

    } else { // Misc transaction table

    //  console.log(transaction)

      if (transaction.TxType == "TransferAsset") {
        entry.type = transaction.Type
      } else if (transaction.TxType == "Vote") {
          if (transaction.Inputs = transaction.Outputs) {
              entry.type = transaction.TxType
          } else {
            if (transaction.Type == "spend") {
              entry.type = transaction.Type
            }
            if (transaction.Type == "income") {
              entry.type = transaction.Type
            }
          }
      } else {
        entry.type = transaction.TxType
      }


      entry.time = transaction.CreateTime
      entry.value = transaction.Value/100000000
      entry.memo = transaction.Memo.slice(14)

      misc.data.push(entry)
    }

  //  }
  }
  parse_payments(payments,misc,value,block_time)
}

function parse_payments(data,data_misc,value,block_time) {

  var all_time = 0
  var recent_vote = 0
  var week = 0
  var month = 0

  Time_Now = Date.now()/1000
  Time_week = 604800
  Time_month = 2628000

  time_first_payment = data.data[data.data.length-1].time

  Timestamp_all = Time_Now - time_first_payment
  Timestamp_recent_vote = block_time/1000
  Timestamp_week = Time_Now - Time_week
  Timestamp_month = Time_Now - Time_month

  for (i=0; i < data.data.length; i++) {

      all_time += data.data[i].value

    if (data.data[i].time > Timestamp_month) {
      month += data.data[i].value
    }

    if (data.data[i].time > Timestamp_week) {
      week += data.data[i].value
    }

    if (data.data[i].time > Timestamp_recent_vote) {
      recent_vote += data.data[i].value
    }
  }

  document.getElementById("all").innerHTML = all_time.toLocaleString(undefined, {maximumFractionDigits:4}) + ' ELA'
  document.getElementById("recent_vote").innerHTML = recent_vote.toLocaleString(undefined, {maximumFractionDigits:4}) + ' ELA'
  document.getElementById("1m").innerHTML = month.toLocaleString(undefined, {maximumFractionDigits:4}) + ' ELA'
  document.getElementById("7d").innerHTML = week.toLocaleString(undefined, {maximumFractionDigits:4}) + ' ELA'

  balance = parseFloat(value)

  Years_elapsed_all_time = parseFloat(Timestamp_all/31536000)
  Years_elapsed_recent_vote = parseFloat((Time_Now - Timestamp_recent_vote)/31536000)


  all_timeARR = parseFloat((all_time/Years_elapsed_all_time)/balance*100)
  document.getElementById("allARR").innerHTML = all_timeARR.toLocaleString(undefined, {maximumFractionDigits:2}) + '% ARR'

  recent_voteARR = parseFloat((recent_vote/Years_elapsed_recent_vote)/balance*100)
  document.getElementById("recent_voteARR").innerHTML = recent_voteARR.toLocaleString(undefined, {maximumFractionDigits:2}) + '% ARR'

  monthARR = parseFloat((month*12)/balance*100)
  document.getElementById("1mARR").innerHTML = monthARR.toLocaleString(undefined, {maximumFractionDigits:2}) + '% ARR'

  weekARR = parseFloat((week*52)/balance*100)
  document.getElementById("7dARR").innerHTML = weekARR.toLocaleString(undefined, {maximumFractionDigits:2}) + '% ARR'

  create_table(data)
  create_misc_table(data_misc)

}

function create_table(data){

  var payments = data
  console.log('Payment table data')
  console.log(payments)

  for (i=0; i < payments.data.length; i++) {
    var time_of_tx = parseInt(payments.data[i].time)*1000
    var date = new Date(time_of_tx);
    var formatted_time = moment(date).format('l LTS')
    payments.data[i].time = formatted_time
  }

  $.fn.dataTable.moment('l LTS');
  $($.fn.dataTable.tables(true)).DataTable().columns.adjust()

  var payments_table = $('#payments-table').DataTable({
      data: payments.data,
      columns: [
              { data: 'time' },
              { data: 'from_name' },
              { data: 'value', "render": $.fn.dataTable.render.number( ',', '.', 5)},
              { data: 'hash',
              "render": function ( data, type, row, meta ) {
                if (data.length > 10) {
                  trunc = data.substr(0,12) + '...' + data.substr(54,12)
                  return '<a style="color:#ffffff;" href="https://blockchain.elastos.org/tx/'+data+'" target="_blank">'+trunc+'</a>';
                }
              } }
         ],
      "order": [[ 0, 'desc' ]],
       pageLength: 20,
       lengthChange: false,
       searching: false,
       "lengthMenu": [[20, 50, 100, 500, 1000], [20, 50, 100, 500, 1000]],
        "drawCallback": function () {
       $('.paginate_button').addClass('white');
       },
       scroller: true,
       scrollX: true
  });

  $("#loader").hide();
  $('#dashboard').show();
  payments_table.columns.adjust()

};

function create_misc_table(data_misc){

  var payments = data_misc
  console.log('Misc transaction table data')
  console.log(payments)

  for (i=0; i < payments.data.length; i++) {
    var time_of_tx = parseInt(payments.data[i].time)*1000
    var date = new Date(time_of_tx);
    var formatted_time = moment(date).format('l LTS')
    payments.data[i].time = formatted_time
  }

  $.fn.dataTable.moment('l LTS');

    $('#misc-table').DataTable({
      data: payments.data,
      columns: [
              { data: 'time' },
              { data: 'type' },
              { data: 'value', "render": $.fn.dataTable.render.number( ',', '.', 5)},
              { data: 'memo' }
         ],
       "columnDefs": [ {
       "targets": 1,
       "createdCell": function (td, cellData, rowData, row, col) {
         if (cellData == "spend") {
           $(td).html('<a style="color:#e8007f;">Send</a>');
         }
         if (cellData == "income") {
           $(td).html('<a style="color:#00cc88;">Receive</a>');
         }
       },
      }],
      "order": [[ 0, 'desc' ]],
       pageLength: 20,
       lengthChange: false,
       searching: false,
        "drawCallback": function () {
       $('.paginate_button').addClass('white');
       },
       scroller: true,
       scrollX: true
  });

};

$(document).ready(function(){

  $('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
      $($.fn.dataTable.tables(true)).DataTable().columns.adjust()
  })

});
