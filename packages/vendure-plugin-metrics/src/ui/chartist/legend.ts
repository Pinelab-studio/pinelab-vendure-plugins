import { extend, alphaNumerate, PieChart } from 'chartist';
var defaultOptions = {
  className: '',
  classNames: false,
  removeAll: false,
  legendNames: false,
  clickable: false,
  onClick: null,
  position: 'top',
};
export function legend(options?: any) {
  // Catch invalid options
  if (options && options.position) {
    if (
      !(
        options.position === 'top' ||
        options.position === 'bottom' ||
        options.position instanceof HTMLElement
      )
    ) {
      throw Error('The position you entered is not a valid position');
    }
    if (options.position instanceof HTMLElement) {
      // Detatch DOM element from options object, because Chartist.extend
      // currently chokes on circular references present in HTMLElements
      var cachedDOMPosition = options.position;
      delete options.position;
    }
  }

  options = extend({}, defaultOptions, options);

  if (cachedDOMPosition) {
    // Reattatch the DOM Element position if it was removed before
    // console.log(cachedDOMPosition)
    options.position = cachedDOMPosition;
  }

  return function legend(chart) {
    function removeLegendElement() {
      var legendElement = chart.container.querySelector('.ct-legend');
      if (legendElement) {
        legendElement.parentNode.removeChild(legendElement);
      }
    }

    // Set a unique className for each series so that when a series is removed,
    // the other series still have the same color.
    function setSeriesClassNames() {
      chart.data.series = chart.data.series.map(function (series, seriesIndex) {
        if (typeof series !== 'object') {
          series = {
            value: series,
          };
        }
        series.className =
          series.className ||
          chart.options.classNames.series + '-' + alphaNumerate(seriesIndex);
        return series;
      });
    }

    function createLegendElement() {
      var legendElement = document.createElement('ul');
      legendElement.className = 'ct-legend';
      if (chart instanceof PieChart) {
        legendElement.classList.add('ct-legend-inside');
      }
      if (
        typeof options.className === 'string' &&
        options.className.length > 0
      ) {
        legendElement.classList.add(options.className);
      }
      if (chart.options.width) {
        legendElement.style.cssText =
          'width: ' + chart.options.width + 'px;margin: 0 auto;';
      }
      return legendElement;
    }

    // Get the right array to use for generating the legend.
    function getLegendNames(useLabels) {
      return (
        options.legendNames ||
        (useLabels ? chart.data.labels : chart.data.series)
      );
    }

    // Initialize the array that associates series with legends.
    // -1 indicates that there is no legend associated with it.
    function initSeriesMetadata(useLabels) {
      var seriesMetadata = new Array(chart.data.series.length);
      for (var i = 0; i < chart.data.series.length; i++) {
        seriesMetadata[i] = {
          data: chart.data.series[i],
          label: useLabels ? chart.data.labels[i] : null,
          legend: -1,
        };
      }
      return seriesMetadata;
    }

    function createNameElement(i, legendText, classNamesViable) {
      var li = document.createElement('li');
      li.classList.add('ct-series-' + i);
      // Append specific class to a legend element, if viable classes are given
      if (classNamesViable) {
        li.classList.add(options.classNames[i]);
      }
      li.setAttribute('data-legend', i);
      li.textContent = legendText;
      return li;
    }

    // Append the legend element to the DOM
    function appendLegendToDOM(legendElement) {
      if (!(options.position instanceof HTMLElement)) {
        switch (options.position) {
          case 'top':
            // console.log('top new ',legendElement);
            chart.container.insertBefore(
              legendElement,
              chart.container.childNodes[0]
            );
            break;

          case 'bottom':
            // console.log('bottom new');
            chart.container.insertBefore(legendElement, null);
            break;
        }
      } else {
        // Appends the legend element as the last child of a given HTMLElement
        options.position.insertBefore(legendElement, null);
        // console.log('else endezih new')
      }
    }

    function addClickHandler(
      legendElement,
      legends,
      seriesMetadata,
      useLabels
    ) {
      legendElement.addEventListener('click', function (e) {
        var li = e.target;
        if (li.parentNode !== legendElement || !li.hasAttribute('data-legend'))
          return;
        e.preventDefault();

        var legendIndex = parseInt(li.getAttribute('data-legend'));
        var legend = legends[legendIndex];

        if (!legend.active) {
          legend.active = true;
          li.classList.remove('inactive');
        } else {
          legend.active = false;
          li.classList.add('inactive');

          var activeCount = legends.filter(function (legend) {
            return legend.active;
          }).length;
          if (!options.removeAll && activeCount == 0) {
            // If we can't disable all series at the same time, let's
            // reenable all of them:
            for (var i = 0; i < legends.length; i++) {
              legends[i].active = true;
              legendElement.childNodes[i].classList.remove('inactive');
            }
          }
        }

        var newSeries: any[] = [];
        var newLabels: any[] = [];

        for (var i = 0; i < seriesMetadata.length; i++) {
          if (
            seriesMetadata[i].legend != -1 &&
            legends[seriesMetadata[i].legend].active
          ) {
            newSeries.push(seriesMetadata[i].data);
            newLabels.push(seriesMetadata[i].label);
          }
        }

        chart.data.series = newSeries;
        if (useLabels) {
          chart.data.labels = newLabels;
        }

        chart.update();

        if (options.onClick) {
          options.onClick(chart, e);
        }
      });
    }

    function createLegend(legendNames) {
      removeLegendElement();
      var legendElement = createLegendElement();
      var useLabels = true; // chart instanceof PieChart && chart.data.labels && chart.data.labels.length;
      // console.log(chart.data);
      var legendNames = chart.data.series.map((s) => s[0].legend); // getLegendNames(useLabels);
      // console.log(legendNames,'legendNames')
      var seriesMetadata = initSeriesMetadata(useLabels);
      var legends: any[] = [];

      // Check if given class names are viable to append to legends
      var classNamesViable =
        Array.isArray(options.classNames) &&
        options.classNames.length === legendNames.length;

      // Loop through all legends to set each name in a list item.
      legendNames.forEach(function (legend, i) {
        var legendText = legend.name || legend;
        var legendSeries = legend.series || [i];

        var li = createNameElement(i, legendText, classNamesViable);
        legendElement.appendChild(li);

        legendSeries.forEach(function (seriesIndex) {
          seriesMetadata[seriesIndex].legend = i;
        });

        legends.push({
          text: legendText,
          series: legendSeries,
          active: true,
        });
      });
      appendLegendToDOM(legendElement);
      if (options.clickable) {
        setSeriesClassNames();
        addClickHandler(legendElement, legends, seriesMetadata, useLabels);
      }
    }

    chart.on('created', function (data) {
      createLegend(chart.data.series.map((s) => s[0].name));
    });
  };
}
