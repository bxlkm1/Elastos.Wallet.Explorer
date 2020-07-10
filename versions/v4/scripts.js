
$(document).ready(function(){

  $( document ).ajaxStart(function() {
    $( "#loader" ).show();
  });

  $('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
      $($.fn.dataTable.tables(true)).DataTable().columns.adjust()
  })

  $('#address').on("keyup", function(e) {
      if (e.keyCode == 13) {
          get_address()
      }
  });

  moment.suppressDeprecationWarnings = true;
});

function doc(id){return document.getElementById(id)}

function get_address() {
  var address = doc("address").value;
  console.log(address)

  $.when(

  $.get("https://cors-anywhere.herokuapp.com/https://node1.elaphant.app/api/1/dpos/address/" + address + "?pageSize=1&pageNum=1", function(data) {
    console.log(data)
  }),
  $.get("https://cors-anywhere.herokuapp.com/https://elanodes.com/api/payout-addresses", function(pay_object) {
  })).then(function(data,pay_object){

    if (data[0].result === null) {

      $.when(

        $.get("https://cors-anywhere.herokuapp.com/https://node1.elaphant.app/api/1/history/" + address, function(data){
            console.log('Raw address history data')
            console.log(data)
            doc("loading_message").innerHTML = "Analyzing transactions..."
        }),

        $.get("https://cors-anywhere.herokuapp.com/https://node1.elaphant.app/api/v1/balance/" + address, function(address_balance){
            console.log('Address balance')
            console.log(address_balance)
        })

      ).then(function(data,address_balance) {
        var data = data[0]
        var address_balance = address_balance[0]
        doc("loading_message").innerHTML = "Analyzing transactions..."
        scan_address_history(data,address,address_balance)

      });

    } else {
    scan_vote_history(data[0],address,pay_object[0])
    }


  })

}


function scan_vote_history(data,address,pay_object) {

  pay_object = JSON.parse(pay_object)

  doc("loading_message").innerHTML = "Checking voting record..."

  var node_names = []
  var inactives = []
  var pay_addresses = {
    result:[]
  }

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

  var block_time = parseInt(data.result[0].Vote_Header.Block_time)
  var date = moment.unix(block_time).format('LLL')
  doc("last_vote").innerHTML = date

  var value = parseFloat(data.result[0].Vote_Header.Value)
  doc("votes_cast").innerHTML = value.toLocaleString(undefined, {maximumFractionDigits:2}) + ' ELA'

  var votes_num = data.result[0].Vote_Header.Node_num
  doc("votes_num").innerHTML = votes_num

  if (votes_num == 0) {
    doc("votes_message").innerHTML = '<span style="color:#e8007f;>Error. This wallet has not voted in the election.<span>'
  } else if (votes_num < 36) {
    var short = 36 - votes_num
      if (inactives.length > 0) {
        doc("votes_message").innerHTML = '<span style="color:#e6b800;">Warning! This wallet may vote for ' + short + ' more supernode(s). ' + inactives.length + ' selections inactive or canceled.</span>'
      } else {
    doc("votes_message").innerHTML = '<span style="color:#e6b800;">Warning! This wallet may vote for ' + short + ' more supernode(s). All selections active.</span>'
    }
  } else if (votes_num == 36) {
      if (inactives.length > 0) {
        doc("votes_message").innerHTML = '<span style="color:#e6b800;">Warning! Maximum votes issued, but ' +  inactives.length + ' selection(s) inactive or canceled.</span>'
      } else {
        doc("votes_message").innerHTML = '<span style="color:#00cc88;">Excellent! Maximum votes issued. All selections active.</span>'
      }
  }

  ul = document.createElement('ul')
  var supernode_list = doc("nodes")
  supernode_list.appendChild(ul)
  supernode_list.classList.add("supernode-list")


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

  $(".supernode-list li").sort(asc_sort).appendTo('.supernode-list');
  function asc_sort(a, b){
      return ($(b).text().toUpperCase()) < ($(a).text().toUpperCase()) ? 1 : -1;
  }

  $.when(

    $.get("https://cors-anywhere.herokuapp.com/https://node1.elaphant.app/api/1/history/" + address, function(data){
        console.log('Raw address history data')
        //data = JSON.parse(data) // Uncomment if using local node
        console.log(data)

        //scan_address_history(data,address,pay_object,pay_object,value,block_time)
    }),

    $.get("https://cors-anywhere.herokuapp.com/https://node1.elaphant.app/api/v1/balance/" + address, function(address_balance){
        console.log('Address balance')
        console.log(address_balance)
    })

  ).then(function(data,address_balance) {
    doc("loading_message").innerHTML = "Analyzing transactions..."
    scan_address_history(data[0],address,address_balance[0],pay_object,pay_object,value,block_time)
  });

}


function scan_address_history(data,address,address_balance,pay_object,pay_addresses,value,block_time) {

  var income_count = 0
  var spend_count = 0

  if (typeof block_time !== "undefined") {
   voting_address(data,address,address_balance,pay_object,pay_addresses,value,block_time)
  } else {
   non_voting_address(data,address,address_balance)
  }

  function voting_address() {

  var payments = {
    data: []
  }

  var misc = {
    data: []
  }

  var votes = []

  for (i = data.result.History.length - 1; i > -1; i--) {

    var transaction = data.result.History[i]

    if (transaction.Type == "income") {
      income_count++
    }

    if (transaction.Type == "spend") {
      spend_count++
    }

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

  }
  populate_wallet_summary(address_balance,data,income_count,spend_count);
  parse_payments(payments,misc,value,block_time)
 }

 function non_voting_address() {

   var all_tx = {
     data: []
   }

   for (i = data.result.History.length - 1; i > -1; i--) {

    var transaction = data.result.History[i]

    if (transaction.Type == "income") {
      income_count++
    }

    if (transaction.Type = "spend") {
      spend_count++
    }

    var send_address = transaction.Inputs
    var entry = {}

    entry.type = transaction.Type
    entry.time = transaction.CreateTime
    entry.value = transaction.Value/100000000
    entry.memo = transaction.Memo.slice(14)

    all_tx.data.push(entry)

 }
  var layout = 'non-voter'
  populate_wallet_summary(data,address,address_balance,income_count,spend_count);
  create_misc_table(all_tx,layout)
}

}

function populate_wallet_summary(data,address,address_balance,income_count,spend_count) {
doc("balance").innerHTML = parseFloat(address_balance.result).toLocaleString(undefined, {maximumFractionDigits:2}) + ' ELA'
var first_tx = moment.unix(data.result.History[0].CreateTime).format('LLL')
doc("created").innerHTML = first_tx
doc("tx_count").innerHTML = data.result.History.length + ' (' + '<i class="fa fa-arrow-down text-success"></i>' + income_count + ' ' + '<i class="fa fa-arrow-up text-danger"></i>' + spend_count + ')'
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
  Timestamp_recent_vote = block_time
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

  doc("all").innerHTML = all_time.toFixed(4) + ' ELA'
  doc("recent_vote").innerHTML = recent_vote.toFixed(4) + ' ELA'
  doc("1m").innerHTML = month.toFixed(4) + ' ELA'
  doc("7d").innerHTML = week.toFixed(4) + ' ELA'

  balance = parseFloat(value)

  Years_elapsed_all_time = parseFloat(Timestamp_all/31536000)
  Years_elapsed_recent_vote = parseFloat((Time_Now - Timestamp_recent_vote)/31536000)


  all_timeARR = parseFloat((all_time/Years_elapsed_all_time)/balance*100)
  doc("allARR").innerHTML = all_timeARR.toFixed(2) + '% ARR'

  recent_voteARR = parseFloat((recent_vote/Years_elapsed_recent_vote)/balance*100)
  doc("recent_voteARR").innerHTML = recent_voteARR.toFixed(2) + '% ARR'

  monthARR = parseFloat((month*12)/balance*100)
  doc("1mARR").innerHTML = monthARR.toFixed(2) + '% ARR'

  weekARR = parseFloat((week*52)/balance*100)
  doc("7dARR").innerHTML = weekARR.toFixed(2) + '% ARR'

  for (i=0; i < data.data.length; i++) {
    var time_of_tx = parseInt(data.data[i].time)
    var formatted_time = moment.unix(time_of_tx).format('l LT')
    data.data[i].time = formatted_time
  }

  var layout = 'voter'
  create_table(data)
  create_misc_table(data_misc,layout)
  $("#loader").hide();
  $('#dashboard').show();
  chart_balance(data)

}

function create_table(data){

  var payments = data
  console.log('Payment table data')
  console.log(payments)

  $.fn.dataTable.moment('l LT');
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
       scrollX: 200
  });

  payments_table.columns.adjust()

};

function create_misc_table(data_misc,layout){

  for (i=0; i < data_misc.data.length; i++) {
    var time_of_tx = parseInt(data_misc.data[i].time)
    var formatted_time = moment.unix(time_of_tx).format('l LT')
    data_misc.data[i].time = formatted_time
  }

  $("#loader").hide();
  $('#dashboard').show();

  if (layout == "non-voter") {
  $('#voting_status').hide();
  $('#supernode_selections').hide();
  $('#voting_rewards_overview').hide()
  }

  var payments = data_misc
  console.log('Misc transaction table data')
  console.log(payments)

  $.fn.dataTable.moment('l LT');

    $('#misc-table').DataTable({
      data: payments.data,
      columns: [
              { data: 'time' },
              { data: 'type' },
              { data: 'value', "render": $.fn.dataTable.render.number( ',', '.', 5)},
              { data: 'memo' }
         ],
       "columnDefs": [{
       "targets": 1,
       "createdCell": function (td, cellData, rowData, row, col) {
         if (cellData == "spend") {
           $(td).html('<a style="color:#e8007f;">Send</a>');
         }
         if (cellData == "income") {
           $(td).html('<a style="color:#00cc88;">Receive</a>');
         }
       },
      },
      ],
      "order": [[ 0, 'desc' ]],
       pageLength: 20,
       lengthChange: false,
       searching: false,
        "drawCallback": function () {
       $('.paginate_button').addClass('white');
       },
       scroller: true,
       scrollX: 200
  });
};

function chart_balance(json) {

  var width = window.innerWidth || document.chart1.clientWidth;
  //console.log(width)
  var ctx = document.getElementById("chart1").getContext('2d')
  var gradient = ctx.createLinearGradient(0,0,width,0);
  /*gradient.addColorStop(0,"rgb(124, 77, 255, 0.4)") // F44336 rgb(244, 67, 54)
  gradient.addColorStop(0.33, "rgb(68, 138, 255, 0.4)") // F50057 rgb(245, 0, 87)
  gradient.addColorStop(0.66,"rgb(0, 188, 212, 0.4)") // FF4081 rgb(255, 64, 129)
  gradient.addColorStop(1,"rgb(29, 233, 182, 0.4)") // FF9100 rgb(255, 145, 0)*/

  gradient.addColorStop(0,"rgb(29, 233, 182, 0.4)") // F44336 rgb(244, 67, 54)
  gradient.addColorStop(0.3, "rgb(0, 188, 212, 0.4)") // F50057 rgb(245, 0, 87)
  gradient.addColorStop(0.6,"rgb(204, 0, 204, 0.4)") // FF4081 rgb(255, 64, 129)
  gradient.addColorStop(1,"rgb(255, 0, 102, 0.4)") // FF9100 rgb(255, 145, 0)


  var labels = json.data.map(function(e) {
    return e.time //.slice(0, -10)
  });

  labels = labels.reverse()

  var data = json.data.map(function(e) {
    return e.value
  });

  data = data.reverse()

  var starting_balance = 0
  for (i=0; i < data.length; i++) {
    starting_balance += data[i]
    data[i] = starting_balance.toFixed(6)
  }

new Chart(ctx, {
  type: 'line',
  data: {
    labels: labels,
    datasets: [{
        data: data,
        label: "Total ELA Rewarded",
        pointBorderColor: gradient,
        pointBackgroundColor: gradient,
        pointHoverBackgroundColor: gradient,
        pointHoverBorderColor: gradient,
        borderColor: gradient,
        pointRadius: 2,
        lineTension: 0.5,
        fill: true,
        backgroundColor: gradient,
        cubicInterpolationMode: 'monotone'
      }
    ]
  },
  options: {
   responsive: true,
   scales: {
     yAxes: [{
       scaleLabel: {
         display: true,
         labelString: 'Elastos Received'
       },
       ticks: {
         beginAtZero: true,
         maxTicksLimit: 20
       }
     }],
     xAxes: [{
       type: 'time',
       distribution: 'linear',
     }],
   },
  }
 });

}
