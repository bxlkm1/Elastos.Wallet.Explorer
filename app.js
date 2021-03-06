$(document).ready(function () {
  $(document).ajaxStart(function () {
    $("#loader").show();
  });

  $('a[data-toggle="tab"]').on("shown.bs.tab", function (e) {
    $($.fn.dataTable.tables(true)).DataTable().columns.adjust();
  });

  $("#address").on("keyup", function (e) {
    if (e.keyCode == 13) {
      $("#input-error").hide();
      get_address();
    }
  });

  moment.suppressDeprecationWarnings = true;
});

function doc(id) {
  return document.getElementById(id);
}

function format_time(object) {
  for (i = 0; i < object.data.length; i++) {
    var time_of_tx = parseInt(object.data[i].timestamp);
    var formatted_time = moment.unix(time_of_tx).format("l LT");
    object.data[i].timestamp = formatted_time;
  }
  return object;
}

function get_address() {
  $("#dashboard").hide();
  $("#payments-table").DataTable().destroy();
  $("#transfers-table").DataTable().destroy();
  $("#internal-tx-table").DataTable().destroy();
  $("#all-table").DataTable().destroy();
  $("#input-error").hide();

  var address = doc("address").value.trim();
  console.log(address);

  if (address.length !== 34) {
    doc("input-error-text").innerHTML = "Invalid address. Please try again.";
    $("#input-error").show();
    return;
  } else {
    $("#input-error").hide();
  }

  $.when(
    $.get(
      "https://node1.elaphant.app/api/1/dpos/address/" +
        address +
        "?pageSize=1&pageNum=1",
      function (data) {
        console.log("Voting History");
        console.log(data);
        doc("loading_message").innerHTML = "Checking voting record...";
      }
    ),
    $.get({
      url: "https://elanodes.com/api/payout-addresses",
      cache: false,
      success: function (pay_object) {
        console.log("Pay object successfully retrieved");
      },
    })
  ).then(function (data, pay_object) {
    if (data[0].result === null) {
      doc("loading_message").innerHTML = "Analyzing transactions...";

      $.when(
        $.get("https://node1.elaphant.app/api/1/history/" + address, function (
          data
        ) {
          console.log("Raw address history data");
          console.log(data);
        }),

        $.get("https://node1.elaphant.app/api/v1/balance/" + address, function (
          address_balance
        ) {
          console.log("Address balance");
          console.log(address_balance);
        })
      ).then(function (data, address_balance) {
        if (data[0].result === "invalid address") {
          $("#loader").hide();
          doc("input-error-text").innerHTML =
            "This address has no transaction history.";
          $("#input-error").show();
          return;
        } else {
          var data = data[0];
          var address_balance = address_balance[0];
          doc("loading_message").innerHTML = "Analyzing transactions...";
          scan_address_history(data, address, address_balance);
        }
      });
    } else {
      scan_vote_history(data[0], address, pay_object[0]);
    }
  });
}

function scan_vote_history(data, address, pay_object) {
  pay_object = JSON.parse(pay_object);

  var node_names = [];
  var inactives = [];
  var canceled = [];
  var pay_addresses = {
    result: [],
  };

  for (i = 0; i < data.result[0].Vote_Body.length; i++) {
    node = data.result[0].Vote_Body[i].Producer_public_key;

    var urls = [];

    var match = _.find(pay_object.result, function (votedNode) {
      return votedNode.Producer_public_key == node;
    });

    pay_addresses.result.push(match);
    var httpString = "http://";
    var httpsString = "https://";
    if (
      match.Website.substr(0, httpString.length) !== httpString &&
      match.Website.substr(0, httpsString.length) !== httpsString
    ) {
      match.Website = httpString + match.Website;
    }

    urls.name = data.result[0].Vote_Body[i].Nickname;
    urls.web = match.Website;

    if (match.State == "Active") {
      node_names.push(urls);
    } else if (match.State == "Inactive") {
      inactives.push(urls);
    } else if (match.State == "Canceled" || match.State == "Returned") {
      canceled.push(urls);
    }
  }

  var block_time = parseInt(data.result[0].Vote_Header.Block_time);
  var date = moment.unix(block_time).format("LLL");
  doc("last_vote").innerHTML = date;

  var value = parseFloat(data.result[0].Vote_Header.Value);
  doc("votes_cast").innerHTML =
    value.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " ELA";

  var votes_num = data.result[0].Vote_Header.Node_num;
  doc("votes_num").innerHTML = votes_num;

  var offline = inactives.length + canceled.length;

  if (votes_num == 0) {
    doc("votes_message").innerHTML =
      '<span style="color:#e8007f;>Error. This wallet has not voted in the election.<span>';
  } else if (votes_num < 36) {
    var short = 36 - votes_num;
    if (canceled.length > 0) {
      doc("votes_message").innerHTML =
        '<span style="color:#e8007f;">Warning! This wallet may vote for ' +
        short +
        " more supernode(s). " +
        offline +
        " selections inactive or canceled.</span>";
    } else if (inactives.length > 0) {
      doc("votes_message").innerHTML =
        '<span style="color:#e6b800;">Warning! This wallet may vote for ' +
        short +
        " more supernode(s). " +
        offline +
        " selections inactive or canceled.</span>";
    } else {
      doc("votes_message").innerHTML =
        '<span style="color:#e6b800;">Warning! This wallet may vote for ' +
        short +
        " more supernode(s). All selections active.</span>";
    }
  } else if (votes_num == 36) {
    if (canceled.length > 0) {
      doc("votes_message").innerHTML =
        '<span style="color:#e8007f;">Warning! Maximum votes issued, but ' +
        offline +
        " selection(s) inactive or canceled.</span>";
    } else if (inactives.length > 0) {
      doc("votes_message").innerHTML =
        '<span style="color:#e6b800;">Warning! Maximum votes issued, but ' +
        offline +
        " selection(s) inactive or canceled.</span>";
    } else {
      doc("votes_message").innerHTML =
        '<span style="color:#00cc88;">Excellent! Maximum votes issued. All selections active.</span>';
    }
  }

  var supernode_list = doc("nodes");
  while (supernode_list.firstChild) {
    supernode_list.removeChild(supernode_list.firstChild);
  }
  ul = document.createElement("ul");
  supernode_list.appendChild(ul);
  supernode_list.classList.add("supernode-list");

  function socials_match(node) {
    var html = "";
    if (socials.hasOwnProperty(node)) {
      for (x in socials[node]) {
        html += socials[node][x] + " ";
      }
      return html;
    } else {
      return "";
    }
  }

  function logo_match(node) {
    if (logos.hasOwnProperty(node)) {
      return logos[node];
    } else {
      return '<img src="images/logos/Dummy.png" class="logo">';
    }
  }

  node_names.forEach(function (node) {
    let li = document.createElement("li");
    ul.appendChild(li);
    li.classList.add("nodes_li");
    var logo = logo_match(node.name);
    var web_link =
      '<a class="url_link" href=' +
      node.web +
      ' target="_blank">' +
      node.name +
      "</a>";
    var web_icon =
      '<a class="social" href=' +
      node.web +
      ' target="_blank" title="Website"><i class="fab fa-chrome fa-sm"></i></a>' +
      " ";
    var social_links = socials_match(node.name);
    li.innerHTML += logo + web_link + "&nbsp&nbsp" + web_icon + social_links;
  });

  inactives.forEach(function (node) {
    let li = document.createElement("li");
    ul.appendChild(li);
    li.classList.add("nodes_li");
    var logo = logo_match(node.name);
    var web_link =
      '<a class="url_link" href=' +
      node.web +
      ' target="_blank">' +
      node.name +
      "</a>";
    var web_icon =
      '<a class="social" href=' +
      node.web +
      ' target="_blank" title="Website"><i class="fab fa-chrome fa-sm"></i></a>' +
      " ";
    var social_links = socials_match(node.name);
    li.innerHTML +=
      logo +
      web_link +
      "&nbsp&nbsp" +
      web_icon +
      social_links +
      " -- Alert: Node currently inactive";
    li.style.color = "#e6b800";
  });

  canceled.forEach(function (node) {
    let li = document.createElement("li");
    ul.appendChild(li);
    li.classList.add("nodes_li");
    var web_link =
      '<a class="url_link" href=' +
      node.web +
      ' target="_blank">' +
      node.name +
      "</a>";
    var web_icon =
      '<a class="social" href=' +
      node.web +
      ' target="_blank" title="Website"><i class="fab fa-chrome fa-sm"></i></a>' +
      " ";
    li.innerHTML +=
      web_link + "&nbsp&nbsp" + web_icon + " -- Warning: Node canceled";
    li.style.color = "#e8007f";
  });

  $(".supernode-list li").sort(asc_sort).appendTo(".supernode-list");
  function asc_sort(a, b) {
    return $(b).text().toUpperCase() < $(a).text().toUpperCase() ? 1 : -1;
  }

  $.when(
    $.get("https://node1.elaphant.app/api/3/history/" + address, function (
      data
    ) {
      console.log("Raw address history data");
      //data = JSON.parse(data) // Uncomment if using local node
      console.log(data);

      //scan_address_history(data,address,pay_object,pay_object,value,block_time)
    }),

    $.get("https://node1.elaphant.app/api/v1/balance/" + address, function (
      address_balance
    ) {
      console.log("Address balance");
      console.log(address_balance);
    })
  ).then(function (data, address_balance) {
    doc("loading_message").innerHTML = "Analyzing transactions...";
    scan_address_history(
      data[0],
      address,
      address_balance[0],
      pay_object,
      value,
      block_time
    );
  });
}

function scan_address_history(
  data,
  address,
  address_balance,
  pay_object,
  value,
  block_time
) {
  var all_tx = {
    data: [],
  };
  var transfers = {
    data: [],
  };
  var internal_tx = {
    data: [],
  };
  var layout = "";
  var entry = {};

  if (typeof block_time !== "undefined") {
    voting_address(
      data,
      address,
      address_balance,
      pay_object,
      value,
      block_time
    );
  } else {
    non_voting_address(data, address, address_balance);
  }

  function voting_address() {
    var income_count = 0;
    var spend_count = 0;
    var payments = {
      data: [],
    };
    var votes = [];

    layout = "voter";

    for (i = data.result.History.length - 1; i > -1; i--) {
      entry = {};

      var transaction = data.result.History[i];

      if (transaction.Type === "income") {
        income_count++;
      }

      if (transaction.Type === "spend") {
        spend_count++;
      }

      //if (transaction.TxType === "TransferAsset") {
      var send_address = transaction.Inputs;

      // NEED TO ADD ELALLIANCE PAYOUT ADDRESS SO IT CAN MATCH. Address added to all 96 nodes right now

      var match0 = _.find(pay_object.result, function (payment) {
        return payment.Payout_wallet[0] == send_address;
      });
      var match1 = _.find(pay_object.result, function (payment) {
        return payment.Payout_wallet[1] == send_address;
      });
      var match2 = _.find(pay_object.result, function (payment) {
        return payment.Payout_wallet[2] == send_address;
      });

      entry.type = transaction.Type;
      entry.timestamp = transaction.CreateTime;
      entry.fee = transaction.Fee;
      entry.height = transaction.Height;
      entry.from = transaction.Inputs;
      entry.to = transaction.Outputs;
      entry.tx_type = transaction.TxType;
      entry.hash = transaction.Txid;
      entry.value = transaction.Value / 100000000;
      entry.memo = transaction.Memo.slice(14);
      entry.category = '<a  style="color:#00cc88">Rewards</a>';
      entry.amount =
        '<a style="color:#00cc88">' +
        "+" +
        (transaction.Value / 100000000).toLocaleString(undefined, {
          maximumFractionDigits: 6,
        }) +
        " ELA" +
        "</a>";

      if (match0 !== undefined) {
        entry.from_name = match0.Nickname;
        if (logos.hasOwnProperty(entry.from_name)) {
          entry.account = logos[entry.from_name] + entry.from_name;
        } else {
          entry.account =
            '<img src="images/logos/Dummy.png" class="logo">' + entry.from_name;
        }
        payments.data.push(entry);
      } else if (match1 !== undefined) {
        entry.from_name = match1.Nickname;
        if (logos.hasOwnProperty(entry.from_name)) {
          entry.account = logos[entry.from_name] + entry.from_name;
        } else {
          entry.account =
            '<img src="images/logos/Dummy.png" class="logo">' + entry.from_name;
        }
        payments.data.push(entry);
      } else if (match2 !== undefined) {
        entry.from_name = match2.Nickname;
        if (logos.hasOwnProperty(entry.from_name)) {
          entry.account = logos[entry.from_name] + entry.from_name;
        } else {
          entry.account =
            '<img src="images/logos/Dummy.png" class="logo">' + entry.from_name;
        }
        payments.data.push(entry);
      } else {
        // Transfers transaction table

        if (
          (transaction.Inputs.length == transaction.Outputs.length &&
            JSON.stringify(transaction.Inputs) ===
              JSON.stringify(transaction.Outputs)) ||
          transaction.Inputs[0] === transaction.Outputs[0] ||
          transaction.Outputs.includes("EZxunTpDtdy89rAWEMzvhUxRbhX1WNtz9T")
        ) {
          if (transaction.Type == "income") {
            var truncate =
              transaction.Txid.substr(0, 20) +
              "... " +
              transaction.Txid.substr(44, 20);
            entry.account =
              "from " +
              '<a class="address_links" style="color:#1898b8" href="https://blockchain.elastos.org/address/' +
              transaction.Inputs[0] +
              '" target="_blank">' +
              transaction.Inputs[0] +
              "</a>" +
              "<br>" +
              '<a class="address_links" style="color:#666666; font-size:0.8em" href="https://blockchain.elastos.org/tx/' +
              transaction.Txid +
              '" target="_blank">' +
              truncate +
              "</a>";

            entry.amount =
              '<a style="color:#00cc88">' +
              "+" +
              (transaction.Value / 100000000).toLocaleString(undefined, {
                maximumFractionDigits: 6,
              }) +
              " ELA" +
              "</a>" +
              "<br>" +
              '<a  style="color:#666666; font-size:0.8em">fee ' +
              (transaction.Fee / 100000000).toLocaleString(undefined, {
                maximumFractionDigits: 8,
              }) +
              "</a>";
          } else if (transaction.Type == "spend") {
            var truncate =
              transaction.Txid.substr(0, 20) +
              "... " +
              transaction.Txid.substr(44, 20);
            entry.account =
              "to " +
              '<a class="address_links" style="color:#1898b8" href="https://blockchain.elastos.org/address/' +
              transaction.Outputs[0] +
              '" target="_blank">' +
              transaction.Outputs[0] +
              "</a>" +
              "<br>" +
              '<a class="address_links" style="color:#666666; font-size:0.8em" href="https://blockchain.elastos.org/tx/' +
              transaction.Txid +
              '" target="_blank">' +
              truncate +
              "</a>";

            entry.amount =
              '<a style="color:#e8007f">' +
              "-" +
              (transaction.Value / 100000000).toLocaleString(undefined, {
                maximumFractionDigits: 6,
              }) +
              " ELA" +
              "</a>" +
              "<br>" +
              '<a  style="color:#666666; font-size:0.8em">fee ' +
              (transaction.Fee / 100000000).toLocaleString(undefined, {
                maximumFractionDigits: 8,
              }) +
              "</a>";
          }

          if (transaction.TxType == "vote") {
            entry.contract = '<a  style="color:#cc99ff">Vote (DPoS)</a>';
            entry.category = '<a  style="color:#cc99ff">Vote (DPoS)</a>';
          } else if (transaction.TxType == "transferAsset") {
            entry.contract = '<a  style="color:#e6b800">UTXO Consolidate</a>';
            entry.category = '<a  style="color:#e6b800">UTXO Consolidate</a>';
          }

          entry.tx_type = transaction.TxType;
          entry.type = transaction.Type;
          entry.timestamp = transaction.CreateTime;
          entry.fee = transaction.Fee;
          entry.height = transaction.Height;
          entry.from = transaction.Inputs;
          entry.to = transaction.Outputs;
          entry.hash = transaction.Txid;
          entry.value = transaction.Value / 100000000;
          entry.memo = transaction.Memo.slice(14);

          internal_tx.data.push(entry);
        } else {
          if (transaction.Type == "income") {
            var truncate =
              transaction.Txid.substr(0, 20) +
              "... " +
              transaction.Txid.substr(44, 20);
            entry.account =
              "from " +
              '<a class="address_links" style="color:#1898b8" href="https://blockchain.elastos.org/address/' +
              transaction.Inputs[0] +
              '" target="_blank">' +
              transaction.Inputs[0] +
              "</a>" +
              "<br>" +
              '<a class="address_links" style="color:#666666; font-size:0.8em" href="https://blockchain.elastos.org/tx/' +
              transaction.Txid +
              '" target="_blank">' +
              truncate +
              "</a>";

            entry.amount =
              '<a style="color:#00cc88">' +
              "+" +
              (transaction.Value / 100000000).toLocaleString(undefined, {
                maximumFractionDigits: 6,
              }) +
              " ELA" +
              "</a>";

            entry.category = '<a  style="color:#1898b8">Receive</a>';
          } else if (transaction.Type == "spend") {
            var truncate =
              transaction.Txid.substr(0, 20) +
              "... " +
              transaction.Txid.substr(44, 20);
            entry.account =
              "to " +
              '<a class="address_links" style="color:#1898b8" href="https://blockchain.elastos.org/address/' +
              transaction.Outputs[0] +
              '" target="_blank">' +
              transaction.Outputs[0] +
              "</a>" +
              "<br>" +
              '<a class="address_links" style="color:#666666; font-size:0.8em" href="https://blockchain.elastos.org/tx/' +
              transaction.Txid +
              '" target="_blank">' +
              truncate +
              "</a>";

            entry.amount =
              '<a style="color:#e8007f">' +
              "-" +
              (transaction.Value / 100000000).toLocaleString(undefined, {
                maximumFractionDigits: 6,
              }) +
              " ELA" +
              "</a>";

            entry.category = '<a  style="color:#e8007f">Send</a>';
          }

          if (transaction.TxType == "CoinBase") {
            var truncate =
              transaction.Txid.substr(0, 20) +
              "... " +
              transaction.Txid.substr(44, 20);
            entry.account =
              "from CoinBase - " +
              '<a class="address_links" style="color:#1898b8" href="https://blockchain.elastos.org/address/' +
              transaction.Inputs[0] +
              '" target="_blank">' +
              transaction.Inputs[0] +
              "</a>" +
              "<br>" +
              '<a class="address_links" style="color:#666666; font-size:0.8em" href="https://blockchain.elastos.org/tx/' +
              transaction.Txid +
              '" target="_blank">' +
              truncate +
              "</a>";

            entry.category = '<a  style="color:#cccc00">Mint</a>';
          }

          entry.tx_type = transaction.TxType;
          entry.type = transaction.Type;
          entry.timestamp = transaction.CreateTime;
          entry.fee = transaction.Fee;
          entry.height = transaction.Height;
          entry.from = transaction.Inputs;
          entry.to = transaction.Outputs;
          entry.value = transaction.Value / 100000000;
          entry.hash = transaction.Txid;
          entry.memo = transaction.Memo.slice(14);

          transfers.data.push(entry);
        }
      }
      all_tx.data.push(entry);
    }
    populate_wallet_summary(
      data,
      address,
      address_balance,
      income_count,
      spend_count
    );
    parse_payments(payments, value, block_time);
  }

  function non_voting_address() {
    var income_count = 0;
    var spend_count = 0;

    layout = "non-voter";

    for (i = data.result.History.length - 1; i > -1; i--) {
      entry = {};
      var transaction = data.result.History[i];

      if (transaction.Type === "income") {
        income_count++;
      }

      if (transaction.Type === "spend") {
        spend_count++;
      }

      var send_address = transaction.Inputs;

      if (
        (transaction.Inputs.length == transaction.Outputs.length &&
          JSON.stringify(transaction.Inputs) ===
            JSON.stringify(transaction.Outputs)) ||
        transaction.Inputs[0] === transaction.Outputs[0] ||
        transaction.Outputs.includes("EZxunTpDtdy89rAWEMzvhUxRbhX1WNtz9T")
      ) {
        if (transaction.Type == "income") {
          var truncate =
            transaction.Txid.substr(0, 20) +
            "... " +
            transaction.Txid.substr(44, 20);
          entry.account =
            "from " +
            '<a class="address_links" style="color:#1898b8" href="https://blockchain.elastos.org/address/' +
            transaction.Inputs[0] +
            '" target="_blank">' +
            transaction.Inputs[0] +
            "</a>" +
            "<br>" +
            '<a class="address_links" style="color:#666666; font-size:0.8em" href="https://blockchain.elastos.org/tx/' +
            transaction.Txid +
            '" target="_blank">' +
            truncate +
            "</a>";

          entry.amount =
            '<a style="color:#00cc88">' +
            "+" +
            (transaction.Value / 100000000).toLocaleString(undefined, {
              maximumFractionDigits: 6,
            }) +
            " ELA" +
            "</a>" +
            "<br>" +
            '<a  style="color:#666666; font-size:0.8em">fee ' +
            (transaction.Fee / 100000000).toLocaleString(undefined, {
              maximumFractionDigits: 8,
            }) +
            "</a>";
        } else if (transaction.Type == "spend") {
          var truncate =
            transaction.Txid.substr(0, 20) +
            "... " +
            transaction.Txid.substr(44, 20);
          entry.account =
            "to " +
            '<a class="address_links" style="color:#1898b8" href="https://blockchain.elastos.org/address/' +
            transaction.Outputs[0] +
            '" target="_blank">' +
            transaction.Outputs[0] +
            "</a>" +
            "<br>" +
            '<a class="address_links" style="color:#666666; font-size:0.8em" href="https://blockchain.elastos.org/tx/' +
            transaction.Txid +
            '" target="_blank">' +
            truncate +
            "</a>";

          entry.amount =
            '<a style="color:#e8007f">' +
            "-" +
            (transaction.Value / 100000000).toLocaleString(undefined, {
              maximumFractionDigits: 6,
            }) +
            " ELA" +
            "</a>" +
            "<br>" +
            '<a  style="color:#666666; font-size:0.8em">fee ' +
            (transaction.Fee / 100000000).toLocaleString(undefined, {
              maximumFractionDigits: 8,
            }) +
            "</a>";
        }

        if (transaction.TxType == "vote") {
          entry.contract = '<a  style="color:#cc99ff">Vote (DPoS)</a>';
          entry.category = '<a  style="color:#cc99ff">Vote (DPoS)</a>';
        } else if (transaction.TxType == "transferAsset") {
          entry.contract = '<a  style="color:#e6b800">UTXO Consolidate</a>';
          entry.category = '<a  style="color:#e6b800">UTXO Consolidate</a>';
        }

        entry.tx_type = transaction.TxType;
        entry.type = transaction.Type;
        entry.timestamp = transaction.CreateTime;
        entry.fee = transaction.Fee;
        entry.height = transaction.Height;
        entry.from = transaction.Inputs;
        entry.to = transaction.Outputs;
        entry.hash = transaction.Txid;
        entry.value = transaction.Value / 100000000;
        entry.memo = transaction.Memo.slice(14);

        internal_tx.data.push(entry);
      } else {
        if (transaction.Type == "income") {
          var truncate =
            transaction.Txid.substr(0, 20) +
            "... " +
            transaction.Txid.substr(44, 20);
          entry.account =
            "from " +
            '<a class="address_links" style="color:#1898b8" href="https://blockchain.elastos.org/address/' +
            transaction.Inputs[0] +
            '" target="_blank">' +
            transaction.Inputs[0] +
            "</a>" +
            "<br>" +
            '<a class="address_links" style="color:#666666; font-size:0.8em" href="https://blockchain.elastos.org/tx/' +
            transaction.Txid +
            '" target="_blank">' +
            truncate +
            "</a>";

          entry.amount =
            '<a style="color:#00cc88">' +
            "+" +
            (transaction.Value / 100000000).toLocaleString(undefined, {
              maximumFractionDigits: 6,
            }) +
            " ELA" +
            "</a>";

          entry.category = '<a  style="color:#00cc88">Receive</a>';
        } else if (transaction.Type == "spend") {
          var truncate =
            transaction.Txid.substr(0, 20) +
            "... " +
            transaction.Txid.substr(44, 20);
          entry.account =
            "to " +
            '<a class="address_links" style="color:#1898b8" href="https://blockchain.elastos.org/address/' +
            transaction.Outputs[0] +
            '" target="_blank">' +
            transaction.Outputs[0] +
            "</a>" +
            "<br>" +
            '<a class="address_links" style="color:#666666; font-size:0.8em" href="https://blockchain.elastos.org/tx/' +
            transaction.Txid +
            '" target="_blank">' +
            truncate +
            "</a>";

          entry.amount =
            '<a style="color:#e8007f">' +
            "-" +
            (transaction.Value / 100000000).toLocaleString(undefined, {
              maximumFractionDigits: 6,
            }) +
            " ELA" +
            "</a>";

          entry.category = '<a  style="color:#e8007f">Send</a>';
        }

        if (transaction.TxType == "CoinBase") {
          var truncate =
            transaction.Txid.substr(0, 20) +
            "... " +
            transaction.Txid.substr(44, 20);
          entry.account =
            "from CoinBase - " +
            '<a class="address_links" style="color:#1898b8" href="https://blockchain.elastos.org/address/' +
            transaction.Inputs[0] +
            '" target="_blank">' +
            transaction.Inputs[0] +
            "</a>" +
            "<br>" +
            '<a class="address_links" style="color:#666666; font-size:0.8em" href="https://blockchain.elastos.org/tx/' +
            transaction.Txid +
            '" target="_blank">' +
            truncate +
            "</a>";

          entry.category = '<a  style="color:#cccc00">Mint</a>';
        }

        '<a style="color:#00cc88">' +
          "+" +
          (transaction.Value / 100000000).toFixed(6) +
          "</a>";
        entry.tx_type = transaction.TxType;
        entry.type = transaction.Type;
        entry.timestamp = transaction.CreateTime;
        entry.fee = transaction.Fee;
        entry.height = transaction.Height;
        entry.from = transaction.Inputs;
        entry.to = transaction.Outputs;
        entry.value = transaction.Value / 100000000;
        entry.hash = transaction.Txid;
        entry.memo = transaction.Memo.slice(14);

        transfers.data.push(entry);
      }
      all_tx.data.push(entry);
    }
    populate_wallet_summary(
      data,
      address,
      address_balance,
      income_count,
      spend_count
    );
  }

  create_transfers_table(transfers, layout);
  if (internal_tx.data.length > 0) {
    create_internal_tx_table(internal_tx);
  } else {
    $("#nav6").hide();
  }
  $("#loader").hide();
  $("#dashboard").show();

  if (layout == "non-voter") {
    $("#voting_status").hide();
    $("#supernode_selections").hide();
    $("#voting_rewards_overview").hide();
    $("#nav3").hide();
    $("#nav4").hide();
  }

  create_balance_chart(all_tx, layout);
  all_tx_table(all_tx);
}

function populate_wallet_summary(
  data,
  address,
  address_balance,
  income_count,
  spend_count
) {
  var data1 = data;
  doc("wallet_address").innerHTML = address;
  doc("balance").innerHTML =
    parseFloat(address_balance.result).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    }) + " ELA";
  var first_tx = moment.unix(data1.result.History[0].CreateTime).format("LLL");
  doc("created").innerHTML = first_tx;
  doc("tx_count").innerHTML =
    data.result.History.length +
    " (" +
    '<i class="fa fa-arrow-down text-success"></i>' +
    income_count +
    " " +
    '<i class="fa fa-arrow-up text-danger"></i>' +
    spend_count +
    ")";
}

function parse_payments(data, value, block_time) {
  var all_time = 0;
  var recent_vote = 0;
  var week = 0;
  var month = 0;

  Time_Now = Date.now() / 1000;
  Time_week = 604800;
  Time_month = 2628000;

  time_first_payment = data.data[data.data.length - 1].timestamp;

  Timestamp_all = Time_Now - time_first_payment;
  Timestamp_recent_vote = block_time;
  Timestamp_week = Time_Now - Time_week;
  Timestamp_month = Time_Now - Time_month;

  for (i = 0; i < data.data.length; i++) {
    all_time += data.data[i].value;

    if (data.data[i].timestamp > Timestamp_month) {
      month += data.data[i].value;
    }

    if (data.data[i].timestamp > Timestamp_week) {
      week += data.data[i].value;
    }

    if (data.data[i].timestamp > Timestamp_recent_vote) {
      recent_vote += data.data[i].value;
    }
  }

  doc("all").innerHTML = all_time.toFixed(4) + " ELA";
  doc("recent_vote").innerHTML = recent_vote.toFixed(4) + " ELA";
  doc("1m").innerHTML = month.toFixed(4) + " ELA";
  doc("7d").innerHTML = week.toFixed(4) + " ELA";

  balance = parseFloat(value);

  Years_elapsed_all_time = parseFloat(Timestamp_all / 31536000);
  Years_elapsed_recent_vote = parseFloat(
    (Time_Now - Timestamp_recent_vote) / 31536000
  );

  all_timeARR = parseFloat((all_time / Years_elapsed_all_time / balance) * 100);
  //doc("allARR").innerHTML = all_timeARR.toFixed(2) + '% ARR'

  recent_voteARR = parseFloat(
    (recent_vote / Years_elapsed_recent_vote / balance) * 100
  );
  doc("recent_voteARR").innerHTML = recent_voteARR.toFixed(2) + "% ARR";

  monthARR = parseFloat(((month * 12) / balance) * 100);
  doc("1mARR").innerHTML = monthARR.toFixed(2) + "% ARR";

  weekARR = parseFloat(((week * 52) / balance) * 100);
  doc("7dARR").innerHTML = weekARR.toFixed(2) + "% ARR";

  for (i = 0; i < data.data.length; i++) {
    if (logos.hasOwnProperty(data.data[i].from_name)) {
      data.data[i].from_name =
        logos[data.data[i].from_name] + data.data[i].from_name;
    } else {
      data.data[i].from_name =
        '<img src="images/logos/Dummy.png" class="logo">' +
        data.data[i].from_name;
    }
  }

  var layout = "voter";
  create_table(data);
  dpos_earnings_chart(data);
}

function create_table(payments) {
  format_time(payments);

  console.log("Payment table data");
  console.log(payments);
  $.fn.dataTable.moment("l LT");
  $($.fn.dataTable.tables(true)).DataTable().columns.adjust();

  var table = $("#payments-table").DataTable({
    data: payments.data,
    columns: [
      { data: "timestamp" },
      { data: "from_name" },
      { data: "amount" },
      {
        data: "hash",
        render: function (data, type, row, meta) {
          if (data.length > 10) {
            trunc = data.substr(0, 6) + "... " + data.substr(58, 6);
            return (
              '<a style="color:#1898b8;" href="https://blockchain.elastos.org/tx/' +
              data +
              '" target="_blank">' +
              trunc +
              "</a>"
            );
          }
        },
      },
    ],
    order: [[0, "desc"]],
    drawCallback: function () {
      $("tr").addClass("primary");
    },
    pageLength: 20,
    lengthChange: false,
    searching: false,
    lengthMenu: [
      [20, 50, 100, 500, 1000],
      [20, 50, 100, 500, 1000],
    ],
    scroller: true,
    scrollX: 200,
  });

  table.columns.adjust();

  function format(d) {
    return (
      '<table class="details_table" cellpadding="5" cellspacing="0" border="0" style="padding-left:50px;">' +
      '<tr class="details-row">' +
      '<td class="details-column" style="font-weight:600">Memo</td>' +
      '<td class="details-column">' +
      d.memo +
      "</td>" +
      "</tr>" +
      '<tr class="details-row">' +
      '<td class="details-column" style="font-weight:600">Payout Address</td>' +
      '<td class="details-column">' +
      d.from +
      "</td>" +
      "</tr>" +
      '<tr class="details-row">' +
      '<td class="details-column" style="font-weight:600">Height</td>' +
      '<td class="details-column">' +
      d.height +
      "</td>" +
      "</tr>" +
      '<tr class="details-row">' +
      '<td class="details-column" style="font-weight:600">Transaction ID</td>' +
      '<td class="details-column">' +
      d.hash +
      "</td>" +
      "</tr>" +
      "</table>"
    );
  }

  $("#payments-table tbody").on("click", "tr.primary", function () {
    var tr = $(this).closest("tr");
    var row = table.row(tr);

    if (row.child.isShown()) {
      row.child.hide();
      tr.removeClass("shown");
    } else {
      row.child(format(row.data())).show();
      tr.addClass("shown");
    }
  });
}

function create_transfers_table(transfers, layout) {
  format_time(transfers);

  console.log("transfers transaction table data");
  console.log(transfers);

  $.fn.dataTable.moment("l LT");

  var table = $("#transfers-table").DataTable({
    data: transfers.data,
    columns: [
      { data: "timestamp" },
      { data: "type" },
      { data: "account" },
      { data: "amount" },
    ],
    columnDefs: [
      {
        targets: 1,
        createdCell: function (td, cellData, rowData, row, col) {
          if (cellData == "spend") {
            $(td).html('<a style="color:#e8007f;">Send</a>');
          }
          if (cellData == "income") {
            $(td).html('<a style="color:#00cc88;">Receive</a>');
          }
        },
      },
    ],
    order: [[0, "desc"]],
    pageLength: 20,
    lengthChange: false,
    searching: false,
    drawCallback: function () {
      $("tr").addClass("primary");
    },
    scroller: true,
    scrollX: 200,
  });

  table.columns.adjust().draw();

  function format(d) {
    return (
      '<table class="details_table" cellpadding="5" cellspacing="0" border="0" style="padding-left:50px;">' +
      '<tr class="details-row">' +
      '<td class="details-column" style="font-weight:600">Memo</td>' +
      '<td class="details-column">' +
      d.memo +
      "</td>" +
      "</tr>" +
      '<tr class="details-row">' +
      '<td class="details-column" style="font-weight:600">From</td>' +
      '<td class="details-column">' +
      d.from +
      "</td>" +
      "</tr>" +
      '<tr class="details-row">' +
      '<td class="details-column" style="font-weight:600">To</td>' +
      '<td class="details-column">' +
      d.to +
      "</td>" +
      "</tr>" +
      '<tr class="details-row">' +
      '<td class="details-column" style="font-weight:600">Contract Type</td>' +
      '<td class="details-column">' +
      d.tx_type +
      "</td>" +
      "</tr>" +
      '<tr class="details-row">' +
      '<td class="details-column" style="font-weight:600">Type</td>' +
      '<td class="details-column">' +
      d.type +
      "</td>" +
      "</tr>" +
      '<tr class="details-row">' +
      '<td class="details-column" style="font-weight:600">Fee</td>' +
      '<td class="details-column">' +
      d.fee +
      "</td>" +
      "</tr>" +
      '<tr class="details-row">' +
      '<td class="details-column" style="font-weight:600">Block</td>' +
      '<td class="details-column">' +
      d.height +
      "</td>" +
      "</tr>" +
      '<tr class="details-row">' +
      '<td class="details-column" style="font-weight:600">Transaction ID</td>' +
      '<td class="details-column">' +
      d.hash +
      "</td>" +
      "</tr>" +
      "</table>"
    );
  }

  $("#transfers-table tbody").on("click", "tr.primary", function () {
    var tr = $(this).closest("tr");
    var row = table.row(tr);

    if (row.child.isShown()) {
      // This row is already open - close it
      row.child.hide();
      tr.removeClass("shown");
    } else {
      // Open this row
      row.child(format(row.data())).show();
      tr.addClass("shown");
    }
  });
}

function create_internal_tx_table(internal_tx) {
  format_time(internal_tx);

  console.log("internal transaction table data");
  console.log(internal_tx);

  $.fn.dataTable.moment("l LT");

  var table = $("#internal-tx-table").DataTable({
    data: internal_tx.data,
    columns: [
      { data: "timestamp" },
      { data: "contract" },
      { data: "account" },
      { data: "amount" },
    ],
    columnDefs: [
      {
        targets: 1,
        createdCell: function (td, cellData, rowData, row, col) {
          if (cellData == "spend") {
            $(td).html('<a style="color:#e8007f;">Send</a>');
          }
          if (cellData == "income") {
            $(td).html('<a style="color:#00cc88;">Receive</a>');
          }
        },
      },
    ],
    order: [[0, "desc"]],
    pageLength: 20,
    lengthChange: false,
    searching: false,
    drawCallback: function () {
      $("tr").addClass("primary");
    },
    scroller: true,
    scrollX: 200,
  });

  function format(d) {
    return (
      '<table class="details_table" cellpadding="5" cellspacing="0" border="0" style="padding-left:50px;">' +
      '<tr class="details-row">' +
      '<td class="details-column" style="font-weight:600">Memo</td>' +
      '<td class="details-column">' +
      d.memo +
      "</td>" +
      "</tr>" +
      '<tr class="details-row">' +
      '<td class="details-column" style="font-weight:600">From</td>' +
      '<td class="details-column">' +
      d.from +
      "</td>" +
      "</tr>" +
      '<tr class="details-row">' +
      '<td class="details-column" style="font-weight:600">To</td>' +
      '<td class="details-column">' +
      d.to +
      "</td>" +
      "</tr>" +
      '<tr class="details-row">' +
      '<td class="details-column" style="font-weight:600">Contract Type</td>' +
      '<td class="details-column">' +
      d.tx_type +
      "</td>" +
      "</tr>" +
      '<tr class="details-row">' +
      '<td class="details-column" style="font-weight:600">Type</td>' +
      '<td class="details-column">' +
      d.type +
      "</td>" +
      "</tr>" +
      '<tr class="details-row">' +
      '<td class="details-column" style="font-weight:600">Fee</td>' +
      '<td class="details-column">' +
      d.fee +
      "</td>" +
      "</tr>" +
      '<tr class="details-row">' +
      '<td class="details-column" style="font-weight:600">Block</td>' +
      '<td class="details-column">' +
      d.height +
      "</td>" +
      "</tr>" +
      '<tr class="details-row">' +
      '<td class="details-column" style="font-weight:600">Transaction ID</td>' +
      '<td class="details-column">' +
      d.hash +
      "</td>" +
      "</tr>" +
      "</table>"
    );
  }

  $("#internal-tx-table tbody").on("click", "tr.primary", function () {
    var tr = $(this).closest("tr");
    var row = table.row(tr);

    if (row.child.isShown()) {
      // This row is already open - close it
      row.child.hide();
      tr.removeClass("shown");
    } else {
      // Open this row
      row.child(format(row.data())).show();
      tr.addClass("shown");
    }
  });
}

function all_tx_table(all) {
  $.fn.dataTable.moment("l LT");

  console.log("all tx");
  console.log(all);

  let first = all.data.length - 1;
  var starting_balance = all.data[first].value;
  for (i = first; i > -1; i--) {
    if (all.data[i].type == "income") {
      starting_balance += all.data[i].value;
      all.data[i].balance =
        '<a style="color:#fff">' +
        starting_balance.toLocaleString(undefined, {
          maximumFractionDigits: 4,
        }) +
        "</a>";
    } else if (all.data[i].type == "spend") {
      starting_balance -= all.data[i].value;
      all.data[i].balance =
        '<a style="color:#fff">' +
        starting_balance.toLocaleString(undefined, {
          maximumFractionDigits: 4,
        }) +
        "</a>";
    }
  }

  var table = $("#all-table").DataTable({
    data: all.data,
    columns: [
      { data: "timestamp" },
      { data: "category" },
      { data: "account" },
      { data: "amount" },
      { data: "balance" },
    ],
    order: [[0, "desc"]],
    pageLength: 20,
    lengthChange: false,
    searching: false,
    lengthMenu: [
      [20, 50, 100, 500, 1000],
      [20, 50, 100, 500, 1000],
    ],
    drawCallback: function () {
      $("tr").addClass("primary");
    },
    scroller: true,
    scrollX: 200,
  });

  table.columns.adjust().draw();

  function format(d) {
    return (
      '<table class="details_table" cellpadding="5" cellspacing="0" border="0" style="padding-left:50px;">' +
      '<tr class="details-row">' +
      '<td class="details-column" style="font-weight:600">Memo</td>' +
      '<td class="details-column">' +
      d.memo +
      "</td>" +
      "</tr>" +
      '<tr class="details-row">' +
      '<td class="details-column" style="font-weight:600">From</td>' +
      '<td class="details-column">' +
      d.from +
      "</td>" +
      "</tr>" +
      '<tr class="details-row">' +
      '<td class="details-column" style="font-weight:600">To</td>' +
      '<td class="details-column">' +
      d.to +
      "</td>" +
      "</tr>" +
      '<tr class="details-row">' +
      '<td class="details-column" style="font-weight:600">Contract Type</td>' +
      '<td class="details-column">' +
      d.tx_type +
      "</td>" +
      "</tr>" +
      '<tr class="details-row">' +
      '<td class="details-column" style="font-weight:600">Type</td>' +
      '<td class="details-column">' +
      d.type +
      "</td>" +
      "</tr>" +
      '<tr class="details-row">' +
      '<td class="details-column" style="font-weight:600">Fee</td>' +
      '<td class="details-column">' +
      d.fee +
      "</td>" +
      "</tr>" +
      '<tr class="details-row">' +
      '<td class="details-column" style="font-weight:600">Block</td>' +
      '<td class="details-column">' +
      d.height +
      "</td>" +
      "</tr>" +
      '<tr class="details-row">' +
      '<td class="details-column" style="font-weight:600">Transaction ID</td>' +
      '<td class="details-column">' +
      d.hash +
      "</td>" +
      "</tr>" +
      "</table>"
    );
  }

  $("#all-table tbody").on("click", "tr.primary", function () {
    var tr = $(this).closest("tr");
    var row = table.row(tr);

    if (row.child.isShown()) {
      // This row is already open - close it
      row.child.hide();
      tr.removeClass("shown");
    } else {
      // Open this row
      row.child(format(row.data())).show();
      tr.addClass("shown");
    }
  });
}

function dpos_earnings_chart(payments) {
  var width = window.innerWidth || document.chart1.clientWidth;
  //console.log(width)
  var ctx = document.getElementById("chart1").getContext("2d");
  var gradient = ctx.createLinearGradient(0, 0, width, 0);

  gradient.addColorStop(0, "rgb(29, 233, 182, 0.4)"); // F44336 rgb(244, 67, 54)
  gradient.addColorStop(0.3, "rgb(0, 188, 212, 0.4)"); // F50057 rgb(245, 0, 87)
  gradient.addColorStop(0.6, "rgb(204, 0, 204, 0.4)"); // FF4081 rgb(255, 64, 129)
  gradient.addColorStop(1, "rgb(255, 0, 102, 0.4)"); // FF9100 rgb(255, 145, 0)

  var labels = payments.data.map(function (e) {
    return e.timestamp; //.slice(0, -10)
  });

  labels = labels.reverse();

  var data = payments.data.map(function (e) {
    return e.value;
  });

  data = data.reverse();

  var starting_balance = 0;
  for (i = 0; i < data.length; i++) {
    starting_balance += data[i];
    data[i] = starting_balance.toFixed(6);
  }

  new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
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
          cubicInterpolationMode: "monotone",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        yAxes: [
          {
            scaleLabel: {
              display: false,
              labelString: "Elastos Received",
            },
            ticks: {
              beginAtZero: true,
              maxTicksLimit: 20,
            },
          },
        ],
        xAxes: [
          {
            type: "time",
            distribution: "linear",
          },
        ],
      },
    },
  });
}

function create_balance_chart(all_tx, layout) {
  console.log("balance chart");
  console.log(all_tx);

  var width = window.innerWidth || document.chart2.clientWidth;
  var ctx = document.getElementById("chart2").getContext("2d");
  var gradient = ctx.createLinearGradient(0, 0, width, 0);

  gradient.addColorStop(0, "rgb(29, 233, 182, 0.4)"); // F44336 rgb(244, 67, 54)
  gradient.addColorStop(0.3, "rgb(0, 188, 212, 0.4)"); // F50057 rgb(245, 0, 87)
  gradient.addColorStop(0.6, "rgb(204, 0, 204, 0.4)"); // FF4081 rgb(255, 64, 129)
  gradient.addColorStop(1, "rgb(255, 0, 102, 0.4)"); // FF9100 rgb(255, 145, 0)

  var labels = all_tx.data.map(function (e) {
    return e.timestamp;
  });
  var data = all_tx.data.map(function (e) {
    return e.value;
  });
  var type = all_tx.data.map(function (e) {
    return e.type;
  });

  labels = labels.reverse();
  data = data.reverse();
  type = type.reverse();

  var starting_balance = data[0];
  for (i = 1; i < data.length; i++) {
    if (type[i] == "income") {
      starting_balance += data[i];
      data[i] = starting_balance.toFixed(6);
    } else if (type[i] == "spend") {
      starting_balance -= data[i];
      data[i] = starting_balance.toFixed(6);
    }
  }

  var balance_chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          data: data,
          label: "Wallet Balance History",
          pointBorderColor: gradient,
          pointBackgroundColor: gradient,
          pointHoverBackgroundColor: gradient,
          pointHoverBorderColor: gradient,
          borderColor: gradient,
          pointRadius: 2,
          lineTension: 0,
          fill: true,
          backgroundColor: gradient,
          steppedLine: true,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      series: {
        step: "left",
      },
      bezierCurve: false,
      responsive: true,
      scales: {
        yAxes: [
          {
            scaleLabel: {
              display: false,
              labelString: "",
            },
            ticks: {
              beginAtZero: true,
              maxTicksLimit: 20,
            },
          },
        ],
        xAxes: [
          {
            type: "time",
            distribution: "linear",
          },
        ],
      },
    },
  });
}
