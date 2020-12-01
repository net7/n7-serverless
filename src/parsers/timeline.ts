import Parser, { Input } from "../interfaces/parser";

export class TimelineParser implements Parser {
    parse({ data }: Input) {
      let timeline = {
        dataSet: []
      };
      data.map(item => {
        const dateStart = item.hasOwnProperty('timeline_year_start') ? item.timeline_year_start : item.timeline_date_start;
        const dateEnd = item.hasOwnProperty('timeline_year_end') ? item.timeline_year_start : item.timeline_date_start;
        timeline.dataSet.push(
          {
          id: item.id,
          content: item.title,
          start: dateStart,
          end: dateEnd
          // end: FIX ME
        })
      })
      return timeline;
    }
  }