import type { GlossaryMetric, GlossarySection, GlossarySectionInfo } from "./glossary.types";

export const GLOSSARY_SECTIONS: GlossarySectionInfo[] = [
  { key: "html", label: "HTML", available: true },
  { key: "css", label: "CSS", available: true },
  { key: "git", label: "Git", available: true },
  { key: "javascript", label: "JavaScript", available: true },
  { key: "typescript", label: "TypeScript", available: true },
  { key: "vue", label: "Vue.js", available: true }
];

export const HTML_GLOSSARY_METRICS: GlossaryMetric[] = [
  {
    order: 1,
    metric: "html_files",
    translation: "Количество HTML-файлов.",
    description: "Количество HTML-файлов, найденных в проекте."
  },
  {
    order: 2,
    metric: "html_bytes_total",
    translation: "Суммарный размер HTML-файлов.",
    description: "Суммарный размер всех HTML-файлов в байтах."
  },
  {
    order: 1,
    metric: "image_files_total",
    translation: "Количество изображений.",
    description: "Общее количество файлов изображений."
  },
  {
    order: 2,
    metric: "image_bytes_total",
    translation: "Суммарный размер изображений.",
    description: "Суммарный размер всех изображений в байтах."
  },
  {
    order: 3,
    metric: "avg_image_size_bytes",
    translation: "Средний размер изображения.",
    description: "Средний размер одного изображения в байтах."
  },
  {
    order: 4,
    metric: "font_files_total",
    translation: "Количество файлов шрифтов.",
    description: "Общее количество файлов шрифтов."
  },
  {
    order: 5,
    metric: "font_bytes_total",
    translation: "Суммарный размер шрифтов.",
    description: "Суммарный размер всех файлов шрифтов в байтах."
  },
  {
    order: 6,
    metric: "avg_font_size_bytes",
    translation: "Средний размер файла шрифта.",
    description: "Средний размер одного файла шрифта в байтах."
  },
  {
    order: 7,
    metric: "uses_avif",
    translation: "Использование AVIF.",
    description: "Используется ли в проекте формат изображений AVIF."
  },
  {
    order: 8,
    metric: "uses_webp",
    translation: "Использование WebP.",
    description: "Используется ли в проекте формат изображений WebP."
  },
  {
    order: 9,
    metric: "dom_nodes_avg",
    translation: "Среднее количество элементов дерева HTML.",
    description: "Среднее количество элементов дерева HTML на страницу."
  },
  {
    order: 10,
    metric: "max_dom_depth_max",
    translation: "Максимальная глубина элементов дерева HTML.",
    description: "Максимальная глубина элементов дерева HTML среди всех страниц."
  },
  {
    order: 11,
    metric: "semantic_ratio_avg",
    translation: "Средняя доля семантических элементов.",
    description:
      "Средняя доля семантических элементов HTML относительно всех элементов или контейнеров."
  },
  {
    order: 12,
    metric: "semantic_elements_total",
    translation: "Количество семантических элементов.",
    description:
      "Общее количество семантических элементов, например header, main, section, article, nav, footer."
  },
  {
    order: 13,
    metric: "nonsemantic_containers_total",
    translation: "Количество несемантических контейнеров.",
    description:
      "Общее количество несемантических контейнеров, обычно div и span, используемых как структурные блоки."
  },
  {
    order: 14,
    metric: "semantic_element_usage_ratio_overall",
    translation: "Общая доля использования семантических элементов.",
    description: "Общая доля использования семантических элементов по проекту."
  },
  {
    order: 15,
    metric: "heading_order_violations_total",
    translation: "Количество нарушений порядка заголовков.",
    description:
      "Общее количество нарушений порядка заголовков, например пропуск уровня с h1 сразу на h3."
  },
  {
    order: 16,
    metric: "img_missing_alt_total",
    translation: "Количество изображений без alt.",
    description: "Количество изображений без атрибута alt или с некорректным alt."
  },
  {
    order: 17,
    metric: "img_total",
    translation: "Количество изображений img.",
    description: "Общее количество тегов изображений img."
  },
  {
    order: 18,
    metric: "form_controls_missing_label_total",
    translation: "Количество элементов формы без label.",
    description: "Количество элементов формы без корректной текстовой метки label."
  },
  {
    order: 19,
    metric: "form_controls_total",
    translation: "Количество элементов формы.",
    description:
      "Общее количество элементов управления формы, например input, select, textarea, button."
  },
  {
    order: 20,
    metric: "duplicate_ids_total",
    translation: "Количество дублирующихся id.",
    description: "Общее количество случаев дублирования id в HTML."
  },
  {
    order: 21,
    metric: "duplicate_id_values_total",
    translation: "Количество повторяющихся значений id.",
    description: "Количество уникальных значений id, которые повторялись больше одного раза."
  },
  {
    order: 22,
    metric: "img_missing_alt_ratio",
    translation: "Доля изображений без alt.",
    description:
      "Доля тегов img без атрибута alt или с некорректным alt относительно общего количества тегов img."
  },
  {
    order: 23,
    metric: "form_controls_missing_label_ratio",
    translation: "Доля элементов формы без label.",
    description:
      "Доля элементов управления формы без корректной текстовой метки label относительно общего количества элементов формы."
  },
  {
    order: 24,
    metric: "vnu_files_checked",
    translation: "Количество файлов, проверенных VNU.",
    description: "Количество файлов, проверенных валидатором HTML Nu Validator (VNU)."
  },
  {
    order: 25,
    metric: "vnu_errors_total",
    translation: "Количество ошибок VNU.",
    description: "Общее количество ошибок, найденных валидатором VNU."
  },
  {
    order: 26,
    metric: "vnu_warnings_total",
    translation: "Количество предупреждений VNU.",
    description: "Общее количество предупреждений, найденных валидатором VNU."
  },
  {
    order: 27,
    metric: "vnu_unparsed_files",
    translation: "Количество неразобранных файлов.",
    description: "Количество файлов, которые валидатор не смог корректно разобрать."
  },
  {
    order: 28,
    metric: "lighthouse_a11y_avg",
    translation: "Средний балл доступности Lighthouse.",
    description:
      "Среднее значение показателя доступности, рассчитанное по результатам проверок всех страниц в Lighthouse."
  },
  {
    order: 29,
    metric: "lighthouse_a11y_min",
    translation: "Минимальный балл доступности Lighthouse.",
    description:
      "Минимальный балл доступности, рассчитанный по результатам проверок всех страниц в Lighthouse."
  },
  {
    order: 30,
    metric: "lighthouse_a11y_max",
    translation: "Максимальный балл доступности Lighthouse.",
    description:
      "Максимальный балл доступности, рассчитанный по результатам проверок всех страниц в Lighthouse."
  },
  {
    order: 31,
    metric: "lighthouse_perf_avg",
    translation: "Средний балл производительности Lighthouse.",
    description:
      "Средний балл производительности, рассчитанный по результатам проверок всех страниц в Lighthouse."
  },
  {
    order: 32,
    metric: "lighthouse_perf_min",
    translation: "Минимальный балл производительности Lighthouse.",
    description:
      "Минимальный балл производительности, рассчитанный по результатам проверок всех страниц в Lighthouse."
  },
  {
    order: 33,
    metric: "lighthouse_perf_max",
    translation: "Максимальный балл производительности Lighthouse.",
    description:
      "Максимальный балл производительности, рассчитанный по результатам проверок всех страниц в Lighthouse."
  },
  {
    order: 34,
    metric: "lighthouse_ttfb_avg_ms",
    translation: "Среднее значение TTFB.",
    description:
      "Среднее значение времени до получения первого байта Time To First Byte (TTFB) в миллисекундах."
  },
  {
    order: 35,
    metric: "lighthouse_ttfb_max_ms",
    translation: "Максимальное значение TTFB.",
    description:
      "Максимальное значение времени до получения первого байта Time To First Byte (TTFB) в миллисекундах."
  },
  {
    order: 36,
    metric: "axe_violations_total",
    translation: "Количество нарушений доступности Axe.",
    description: "Общее количество нарушений доступности, найденных инструментом Axe."
  },
  {
    order: 37,
    metric: "axe_critical",
    translation: "Количество критических нарушений Axe.",
    description: "Количество нарушений доступности критического уровня."
  },
  {
    order: 38,
    metric: "axe_serious",
    translation: "Количество серьёзных нарушений Axe.",
    description: "Количество нарушений доступности серьёзного уровня."
  },
  {
    order: 39,
    metric: "axe_moderate",
    translation: "Количество умеренных нарушений Axe.",
    description: "Количество нарушений доступности умеренного уровня."
  },
  {
    order: 40,
    metric: "axe_minor",
    translation: "Количество незначительных нарушений Axe.",
    description: "Количество нарушений доступности незначительного уровня."
  }
];

export const CSS_GLOSSARY_METRICS: GlossaryMetric[] = [
  {
    order: 1,
    metric: "css_files",
    translation: "Количество CSS-файлов.",
    description: "Количество CSS-файлов, найденных в проекте."
  },
  {
    order: 2,
    metric: "css_bytes_total",
    translation: "Суммарный размер CSS-файлов.",
    description: "Суммарный размер всех CSS-файлов в байтах."
  },
  {
    order: 3,
    metric: "rules_total",
    translation: "Количество CSS-правил.",
    description: "Общее количество CSS-правил."
  },
  {
    order: 4,
    metric: "selectors_total",
    translation: "Количество CSS-селекторов.",
    description: "Общее количество CSS-селекторов."
  },
  {
    order: 5,
    metric: "avg_declarations_per_rule_avg",
    translation: "Среднее количество объявлений в правиле.",
    description: "Среднее количество CSS-объявлений в одном правиле."
  },
  {
    order: 6,
    metric: "max_declarations_per_rule_max",
    translation: "Максимальное количество объявлений в правиле.",
    description: "Максимальное количество CSS-объявлений, найденное в одном правиле."
  },
  {
    order: 7,
    metric: "import_count_total",
    translation: "Количество директив @import.",
    description: "Общее количество директив @import в CSS."
  },
  {
    order: 8,
    metric: "avg_specificity_avg",
    translation: "Средняя специфичность селекторов.",
    description: "Средняя специфичность CSS-селекторов."
  },
  {
    order: 9,
    metric: "max_specificity_max",
    translation: "Максимальная специфичность селектора.",
    description: "Максимальная специфичность CSS-селектора в проекте."
  },
  {
    order: 10,
    metric: "specificity_variance_overall",
    translation: "Дисперсия специфичности селекторов.",
    description: "Дисперсия значений CSS-специфичности по всем селекторам проекта."
  },
  {
    order: 11,
    metric: "complex_selectors_ratio_avg",
    translation: "Доля сложных селекторов.",
    description: "Средняя доля сложных CSS-селекторов."
  },
  {
    order: 12,
    metric: "total_selector_complexity_total",
    translation: "Суммарная сложность селекторов.",
    description: "Суммарная сложность всех CSS-селекторов по проекту."
  },
  {
    order: 13,
    metric: "avg_selector_complexity_overall",
    translation: "Средняя сложность селектора.",
    description: "Средняя сложность CSS-селектора по проекту."
  },
  {
    order: 14,
    metric: "max_selector_complexity_max",
    translation: "Максимальная сложность селектора.",
    description: "Максимальная сложность одного CSS-селектора."
  },
  {
    order: 15,
    metric: "unique_css_properties_work",
    translation: "Количество уникальных CSS-свойств.",
    description: "Количество уникальных CSS-свойств, используемых в проекте."
  },
  {
    order: 16,
    metric: "unique_css_properties_avg",
    translation: "Среднее количество уникальных CSS-свойств.",
    description: "Среднее количество уникальных CSS-свойств, рассчитанное по CSS-файлам проекта."
  },
  {
    order: 17,
    metric: "dup_decl_ratio_avg",
    translation: "Доля дублирующихся CSS-объявлений.",
    description:
      "Средняя доля дублирующихся CSS-объявлений относительно общего количества объявлений."
  }
];

export const GIT_GLOSSARY_METRICS: GlossaryMetric[] = [
  {
    order: 1,
    metric: "total_commit_count",
    translation: "Общее количество коммитов.",
    description: "Общее число коммитов в истории репозитория."
  },
  {
    order: 2,
    metric: "meaningful_commit_count",
    translation: "Количество содержательных коммитов.",
    description:
      "Количество коммитов, отражающих содержательные изменения в работе и не относящихся к служебным или пустым изменениям."
  },
  {
    order: 3,
    metric: "active_days",
    translation: "Число активных дней.",
    description: "Количество дней, в которые студент вносил изменения в репозиторий."
  },
  {
    order: 4,
    metric: "night_commit_pct",
    translation: "Доля ночных коммитов.",
    description: "Процент коммитов, сделанных в ночное время, относительно общего числа коммитов."
  },
  {
    order: 5,
    metric: "median_commit_size",
    translation: "Медианный размер коммита.",
    description:
      "Медианное количество изменённых строк в одном коммите с учётом добавленных и удалённых строк."
  },
  {
    order: 6,
    metric: "development_duration_days",
    translation: "Продолжительность разработки.",
    description: "Количество дней между первым и последним коммитом в репозитории."
  },
  {
    order: 7,
    metric: "total_lines_added",
    translation: "Суммарное количество добавленных строк.",
    description: "Общее количество строк, добавленных во всех коммитах."
  },
  {
    order: 8,
    metric: "total_lines_deleted",
    translation: "Суммарное количество удалённых строк.",
    description: "Общее количество строк, удалённых во всех коммитах."
  },
  {
    order: 9,
    metric: "code_churn",
    translation: "Интенсивность изменения кода.",
    description:
      "Общий объём изменений в коде, рассчитываемый по количеству добавленных и удалённых строк."
  },
  {
    order: 10,
    metric: "churn_ratio",
    translation: "Доля переработки кода.",
    description:
      "Показатель, отражающий долю удалённых или переработанных строк в общем объёме изменений."
  }
];

export const JAVASCRIPT_GLOSSARY_METRICS: GlossaryMetric[] = [
  {
    order: 1,
    metric: "lines_of_code",
    translation: "Количество строк кода.",
    description: "Количество строк кода без учёта пустых строк и комментариев."
  },
  {
    order: 2,
    metric: "functions_count_user",
    translation: "Количество пользовательских функций.",
    description: "Количество функций и методов, написанных пользователем."
  },
  {
    order: 3,
    metric: "functions_count_all",
    translation: "Общее количество функций.",
    description:
      "Общее количество пользовательских функций, а также вызовов встроенных функций языка JavaScript, например map, filter, reduce, setTimeout и других."
  },
  {
    order: 4,
    metric: "average_function_size",
    translation: "Средний размер функции.",
    description: "Среднее количество строк кода на одну функцию."
  },
  {
    order: 5,
    metric: "files_count",
    translation: "Количество файлов.",
    description: "Количество файлов с исходным кодом, вошедших в анализ."
  },
  {
    order: 6,
    metric: "cyclomatic_complexity_avg",
    translation: "Средняя цикломатическая сложность.",
    description: "Среднее значение цикломатической сложности по всему анализируемому коду."
  },
  {
    order: 7,
    metric: "cyclomatic_complexity_sum",
    translation: "Суммарная цикломатическая сложность.",
    description: "Суммарное значение цикломатической сложности по всему анализируемому коду."
  },
  {
    order: 8,
    metric: "maximum_nesting_depth",
    translation: "Максимальная глубина вложенности.",
    description:
      "Максимальная глубина вложенности управляющих конструкций: if, for, while, try и других."
  },
  {
    order: 9,
    metric: "max_parameters_per_function",
    translation: "Максимальное число параметров функции.",
    description:
      "Максимальное количество параметров у одной функции среди всех пользовательских функций."
  },
  {
    order: 10,
    metric: "halstead_volume",
    translation: "Объём Холстеда.",
    description:
      "Метрика Холстеда, отражающая объём программы на основе количества операторов и операндов."
  },
  {
    order: 11,
    metric: "halstead_difficulty",
    translation: "Трудность Холстеда.",
    description: "Метрика Холстеда, оценивающая сложность понимания и реализации кода."
  },
  {
    order: 12,
    metric: "halstead_effort",
    translation: "Усилие Холстеда.",
    description: "Метрика Холстеда, оценивающая трудозатраты на понимание или реализацию кода."
  },
  {
    order: 13,
    metric: "cognitive_complexity",
    translation: "Когнитивная сложность.",
    description: "Показатель сложности понимания кода с учётом вложенности."
  },
  {
    order: 14,
    metric: "eslint_errors_count",
    translation: "Количество ошибок ESLint.",
    description: "Количество ошибок и нарушений, найденных инструментом ESLint."
  },
  {
    order: 15,
    metric: "eslint_warnings_count",
    translation: "Количество предупреждений ESLint.",
    description: "Количество предупреждений, найденных инструментом ESLint."
  },
  {
    order: 16,
    metric: "internal_similarity",
    translation: "Дублирование кода в процентах.",
    description: "Процент внутреннего сходства или дублирования кода внутри проекта."
  },
  {
    order: 17,
    metric: "maintainability",
    translation: "Сопровождаемость.",
    description: "Индекс или оценка сопровождаемости кода."
  },
  {
    order: 18,
    metric: "complex_methods_count",
    translation: "Количество сложных методов.",
    description: "Число функций или методов с цикломатической сложностью больше 20."
  },
  {
    order: 19,
    metric: "long_parameter_list_count",
    translation: "Количество длинных списков параметров.",
    description: "Число функций или методов с количеством параметров больше 5."
  },
  {
    order: 20,
    metric: "dead_code_count",
    translation: "Количество мёртвого кода.",
    description:
      "Число недостижимых инструкций внутри блоков кода, расположенных после return, throw, continue или break."
  },
  {
    order: 21,
    metric: "long_methods_count",
    translation: "Количество длинных методов.",
    description:
      "Число пользовательских функций или методов, длина которых превышает 105 строк при цикломатической сложности больше 9."
  },
  {
    order: 22,
    metric: "unused_parameters_count",
    translation: "Количество неиспользуемых параметров.",
    description: "Число параметров функций, которые объявлены, но не используются в теле функции."
  },
  {
    order: 23,
    metric: "unused_variables_count",
    translation: "Количество неиспользуемых переменных.",
    description: "Число переменных, которые объявлены в коде, но не используются."
  },
  {
    order: 24,
    metric: "undeclared_variables_count",
    translation: "Количество необъявленных переменных.",
    description:
      "Число обращений к идентификаторам, которые не были объявлены в доступной области видимости и не входят в список известных глобальных объектов."
  },
  {
    order: 25,
    metric: "long_message_chains_count",
    translation: "Количество длинных цепочек обращений.",
    description: "Число цепочек обращений к свойствам или методам объектов длиной 4 и более."
  },
  {
    order: 26,
    metric: "long_scope_chaining_count",
    translation: "Количество длинных цепочек областей видимости.",
    description: "Число случаев, когда глубина вложенности функций превышает 3 уровня."
  },
  {
    order: 27,
    metric: "inner_html_usage_count",
    translation: "Количество использований innerHTML.",
    description:
      "Число обращений к свойству innerHTML. Может указывать на потенциальный риск XSS при вставке непроверенных данных."
  },
  {
    order: 28,
    metric: "switch_without_default_count",
    translation: "Количество операторов switch без default.",
    description: "Число операторов switch, в которых отсутствует ветка default."
  }
];

export const TYPESCRIPT_GLOSSARY_METRICS: GlossaryMetric[] = [
  {
    order: 3,
    metric: "Chain Length Maximum (CHAIN LENGTH max)",
    translation: "Максимальная длина цепочки вызовов или обращений.",
    description:
      "Максимальная длина цепочки обращений к свойствам, индексам или вызовам функций, например a.b().c.d()."
  },
  {
    order: 4,
    metric: "Async Usage Total (ASYNC USAGE total)",
    translation: "Общее использование асинхронности.",
    description:
      "Суммарное количество асинхронных конструкций: async-функций, await, цепочек .then(), .catch(), .finally() и созданий new Promise."
  },
  {
    order: 5,
    metric: "Async Usage per Lines of Code (ASYNC USAGE per LOC)",
    translation: "Использование асинхронности на строку кода.",
    description:
      "Отношение общего количества асинхронных конструкций к числу строк кода. Показывает плотность использования асинхронной логики."
  },
  {
    order: 6,
    metric: "Method Lines of Code Average (MLOC avg)",
    translation: "Средний размер метода или функции.",
    description: "Среднее количество непустых физических строк внутри тела функции или метода."
  },
  {
    order: 7,
    metric: "Method Lines of Code Maximum (MLOC max)",
    translation: "Максимальный размер метода или функции.",
    description:
      "Максимальное количество непустых физических строк внутри тела одной функции или метода."
  },
  {
    order: 8,
    metric: "API Documentation Index (ADI)",
    translation: "Индекс документации API.",
    description:
      "Доля экспортируемых функций и публичных методов, имеющих JSDoc-комментарий длиной не менее 10 слов."
  },
  {
    order: 9,
    metric: "API Method Name Overloading Index (AMNOI)",
    translation: "Индекс перегрузки методов API.",
    description:
      "Показатель различия возвращаемых типов у перегруженных функций или методов. Рассчитывается для элементов API с несколькими сигнатурами вызова."
  },
  {
    order: 10,
    metric: "API Method Grouping Index (AMGI)",
    translation: "Индекс группировки методов API.",
    description:
      "Показатель того, насколько методы с близкими смысловыми действиями расположены рядом внутри экспортируемых классов."
  },
  {
    order: 11,
    metric: "API Parameter List Consistency Index (APLCI)",
    translation: "Индекс согласованности списков параметров API.",
    description:
      "Показатель согласованности порядка и набора параметров у функций, объединённых по близкому имени."
  },
  {
    order: 12,
    metric: "API Parameter List Complexity Index (APXI)",
    translation: "Индекс сложности списков параметров API.",
    description:
      "Показатель сложности параметров публичных функций и методов. Учитывает количество параметров, последовательности параметров одного типа, необязательные параметры и rest-параметры."
  },
  {
    order: 13,
    metric: "API Exception Specificity Index (AESI)",
    translation: "Доля типизированных выбрасываний ошибок.",
    description:
      "Отношение количества throw, где выбрасывается пользовательский класс ошибки, к общему числу throw."
  },
  {
    order: 14,
    metric: "API Thread Safety Index (ATSI)",
    translation: "Индекс потокобезопасности API.",
    description:
      "Доля элементов публичного API, в документации которых встречаются слова, связанные с потокобезопасностью или конкурентностью: thread, safe, concurrency, race, atomic, mutex, lock, worker."
  },
  {
    order: 15,
    metric: "Typed Error Handling Score",
    translation: "Оценка типизированной обработки ошибок.",
    description:
      "Агрегированный показатель качества обработки ошибок. Учитывает долю типизированных throw, долю catch с сужением ошибки через instanceof и долю API-функций, возвращающих Result или Either."
  },
  {
    order: 16,
    metric: "Discriminated Unions Share (Disc Unions share)",
    translation: "Доля дискриминируемых объединений.",
    description: "Доля union-типов, которые имеют общий литеральный признак-дискриминатор."
  },
  {
    order: 17,
    metric: "Generic Precision Score",
    translation: "Оценка точности generic-типов.",
    description:
      "Показатель качества использования generic-параметров. Учитывает наличие ограничений extends и штрафует за утечки any и чрезмерное число generic-параметров."
  },
  {
    order: 18,
    metric: "Strict Enabled",
    translation: "Включён строгий режим TypeScript.",
    description:
      "Логический показатель, отражающий, включён ли параметр strict в настройках TypeScript-проекта."
  },
  {
    order: 19,
    metric: "Explicit Any Count",
    translation: "Количество явных any.",
    description: "Число прямых использований типа any в исходном коде."
  },
  {
    order: 20,
    metric: "Explicit Unknown Count",
    translation: "Количество явных unknown.",
    description: "Число прямых использований типа unknown в исходном коде."
  },
  {
    order: 21,
    metric: "Implicit Any Count",
    translation: "Количество неявных any.",
    description: "Число диагностик TypeScript, связанных с сообщением implicitly has an 'any' type."
  },
  {
    order: 20,
    metric: "Type Assertions Count",
    translation: "Количество утверждений типов.",
    description: "Число приведений типов через as или синтаксис <T>value."
  },
  {
    order: 21,
    metric: "Type Safety Score",
    translation: "Оценка безопасности типов.",
    description:
      "Итоговая оценка типовой безопасности. Начинается со 100 баллов и снижается за выключенный strict, использование any, неявные any, утверждения типов и использование unknown."
  }
];

export const VUE_GLOSSARY_METRICS: GlossaryMetric[] = [
  {
    order: 1,
    metric: "TS_ANY_VUE",
    translation: "Использования any в TypeScript.",
    description:
      "Количество мест, где используется тип any в TypeScript-коде Vue-компонентов или скриптов."
  },
  {
    order: 2,
    metric: "FORCE_UPDATE_VUE",
    translation: "Принудительные обновления Vue.",
    description:
      "Количество вызовов принудительного обновления компонента, например $forceUpdate. Может указывать на обход механизма реактивности."
  },
  {
    order: 3,
    metric: "REF_OBJARR_VUE",
    translation: "ref для object или array.",
    description:
      "Количество случаев использования ref для сложных структур, таких как object или array, где часто предпочтительнее использовать reactive."
  },
  {
    order: 4,
    metric: "DOM_CALLS_VUE",
    translation: "Прямые обращения к DOM.",
    description:
      "Количество прямых обращений к DOM, например document.*, querySelector и аналогичные вызовы внутри Vue-кода."
  },
  {
    order: 5,
    metric: "COG_COMPLEX_VUE",
    translation: "Когнитивная сложность.",
    description:
      "Оценка сложности понимания кода с учётом ветвлений, вложенности и переходов, аналогично метрике Cognitive Complexity в Sonar."
  },
  {
    order: 6,
    metric: "SMELL_VFOR_NOKEY",
    translation: "v-for без key.",
    description:
      "Количество случаев, где в директиве v-for отсутствует :key. Такое нарушение может приводить к некорректному обновлению списков."
  },
  {
    order: 7,
    metric: "SMELL_VHTML",
    translation: "Использование v-html.",
    description:
      "Количество случаев использования директивы v-html, которая вставляет HTML-код в страницу и может создавать риск XSS при работе с непроверенными данными."
  },
  {
    order: 8,
    metric: "SMELL_MUT_PROPS",
    translation: "Мутация props.",
    description:
      "Количество случаев, где входные параметры props изменяются напрямую в дочернем компоненте, что нарушает однонаправленный поток данных."
  },
  {
    order: 9,
    metric: "SMELL_PROPS_REACT_LOSS",
    translation: "Потеря реактивности props.",
    description:
      "Количество случаев, где из-за деструктурирования или копирования теряется реактивность props, и данные перестают обновляться автоматически."
  },
  {
    order: 10,
    metric: "VMD_TOTAL_ISSUES",
    translation: "Всего проблем VMD.",
    description:
      "Общее число проблем и нарушений, найденных инструментом Vue Mess Detector по набору правил анализа."
  },
  {
    order: 11,
    metric: "VMD_NO_TS_LANG",
    translation: "Отсутствие TypeScript.",
    description:
      'Количество файлов или компонентов, где скрипт не использует TypeScript, например отсутствует lang="ts".'
  },
  {
    order: 12,
    metric: "VMD_PLAIN_SCRIPT",
    translation: "Обычный script без TypeScript.",
    description: "Количество случаев использования блока <script> без указания TypeScript."
  },
  {
    order: 13,
    metric: "VMD_HTML_LINKS",
    translation: "HTML-ссылки.",
    description:
      "Количество HTML-ссылок в шаблоне или связанная с ними проверка, выполняемая инструментом VMD."
  },
  {
    order: 14,
    metric: "VMD_NO_INLINE_STYLES",
    translation: "Inline-стили.",
    description: 'Проверка или счётчик случаев использования inline-стилей style="..." в шаблоне.'
  },
  {
    order: 15,
    metric: "VMD_SHORT_VAR",
    translation: "Слишком короткие имена.",
    description:
      "Количество случаев, где имена переменных слишком короткие и могут снижать читаемость кода."
  },
  {
    order: 16,
    metric: "VMD_COMMENTS",
    translation: "Количество комментариев.",
    description:
      "Число комментариев или их доля, используемая как индикатор документированности либо избыточной зашумлённости кода."
  },
  {
    order: 17,
    metric: "VMD_BIG_VIF",
    translation: "Большие условия v-if.",
    description:
      "Количество сложных или длинных условий в директиве v-if, которые ухудшают читаемость шаблона."
  },
  {
    order: 18,
    metric: "VMD_BIG_VSHOW",
    translation: "Большие условия v-show.",
    description: "Количество сложных или длинных условий в директиве v-show."
  },
  {
    order: 19,
    metric: "VMD_COMPL_COND",
    translation: "Сложные условия.",
    description:
      "Количество сложных логических условий в шаблоне или скрипте, которые трудны для понимания и тестирования."
  },
  {
    order: 20,
    metric: "VMD_CC",
    translation: "Цикломатическая сложность.",
    description: "Оценка цикломатической сложности по правилам или подходу Vue Mess Detector."
  },
  {
    order: 21,
    metric: "VMD_COMP_SIDEFX",
    translation: "Побочные эффекты в computed.",
    description:
      "Количество computed-свойств с побочными эффектами, например мутациями или вызовами функций, что нарушает ожидаемую чистоту computed."
  },
  {
    order: 22,
    metric: "VMD_DEEP_INDENT",
    translation: "Глубокая вложенность.",
    description:
      "Количество случаев слишком глубокой вложенности, которая ухудшает читаемость кода."
  },
  {
    order: 23,
    metric: "VMD_ELSE",
    translation: "Проблемные else-ветвления.",
    description:
      "Проверка или счётчик сложных else-ветвлений, влияющих на читаемость и простоту понимания логики."
  },
  {
    order: 24,
    metric: "VMD_FN_SIZE",
    translation: "Размер функций.",
    description:
      "Количество функций, превышающих заданный порог размера. Может указывать на недостаточную декомпозицию логики."
  },
  {
    order: 25,
    metric: "VMD_IMG_ELEMS",
    translation: "HTML-изображения.",
    description:
      "Количество элементов img или связанных с ними проверок, например наличия атрибута alt."
  },
  {
    order: 26,
    metric: "VMD_HUGE_FILES",
    translation: "Большие файлы.",
    description:
      "Количество файлов, превышающих порог размера. Может указывать на слишком крупные компоненты или слабую декомпозицию."
  },
  {
    order: 27,
    metric: "VMD_IF_NO_CURLY",
    translation: "if без фигурных скобок.",
    description:
      "Количество случаев использования if без фигурных скобок, что может повышать риск ошибок при последующих изменениях кода."
  },
  {
    order: 28,
    metric: "VMD_MAGIC_NUM",
    translation: "Магические числа.",
    description:
      "Количество числовых литералов, использованных без именованных констант и пояснения смысла."
  },
  {
    order: 29,
    metric: "VMD_NESTED_TERN",
    translation: "Вложенный тернарный оператор.",
    description: "Количество случаев вложенных тернарных выражений, ухудшающих читаемость кода."
  },
  {
    order: 30,
    metric: "VMD_NO_IMPORTANT",
    translation: "Использование !important.",
    description: "Проверка или счётчик случаев использования !important в стилях."
  },
  {
    order: 31,
    metric: "VMD_NO_DOM",
    translation: "Прямой доступ к DOM.",
    description:
      "Количество нарушений правила, запрещающего прямое обращение к DOM внутри компонентов."
  },
  {
    order: 32,
    metric: "VMD_NO_PROP_DESTR",
    translation: "Деструктурирование props.",
    description:
      "Количество нарушений правила, предотвращающего потерю реактивности при деструктурировании props."
  },
  {
    order: 33,
    metric: "VMD_NO_SKIP_TESTS",
    translation: "Пропущенные тесты.",
    description: "Проверка или счётчик пропущенных тестов, например случаев использования .skip."
  },
  {
    order: 34,
    metric: "VMD_NO_VAR",
    translation: "Использование var.",
    description: "Количество случаев использования var вместо let или const."
  },
  {
    order: 35,
    metric: "VMD_PARAM_COUNT",
    translation: "Число параметров.",
    description: "Количество функций, превышающих заданный порог по числу параметров."
  },
  {
    order: 36,
    metric: "VMD_PROPS_DRILL",
    translation: "Проброс props через цепочку компонентов.",
    description:
      "Количество случаев чрезмерной передачи данных через цепочку вложенных компонентов."
  },
  {
    order: 37,
    metric: "VMD_REPEAT_CSS",
    translation: "Повторяющийся CSS.",
    description: "Количество повторяющихся CSS-правил или фрагментов стилей."
  },
  {
    order: 38,
    metric: "VMD_SCRIPT_LEN",
    translation: "Длина script-блока.",
    description:
      "Размер части <script> в компоненте. Большое значение может указывать на крупный компонент или низкую связность."
  },
  {
    order: 39,
    metric: "VMD_TOO_MANY_PROPS",
    translation: "Слишком много props.",
    description:
      "Количество компонентов, превышающих порог по числу props, что может указывать на рост связанности и сложности API компонента."
  },
  {
    order: 40,
    metric: "VMD_VFOR_EXPR",
    translation: "Сложные выражения в v-for.",
    description: "Количество сложных или потенциально проблемных выражений внутри директивы v-for."
  },
  {
    order: 41,
    metric: "VMD_VFOR_IDX_KEY",
    translation: "Индекс как key в v-for.",
    description:
      "Количество случаев, где в v-for значение :key задано индексом, что может нарушать корректность обновления списка."
  },
  {
    order: 42,
    metric: "VMD_ZERO_LEN_CMP",
    translation: "Сравнение с нулевой длиной.",
    description:
      "Количество проверок вида arr.length == 0 или аналогичных выражений, если такое правило фиксируется инструментом."
  },
  {
    order: 43,
    metric: "VUEX_LOC",
    translation: "Строки кода Vuex.",
    description:
      "Количество строк кода, относящихся к Vuex: store, modules, actions, mutations, getters и другим связанным частям."
  },
  {
    order: 44,
    metric: "VUEX_FNS_USER",
    translation: "Пользовательские функции Vuex.",
    description:
      "Количество пользовательских функций во Vuex-части проекта, например actions, mutations и getters."
  },
  {
    order: 45,
    metric: "VUEX_FNS_ALL",
    translation: "Все функции Vuex.",
    description:
      "Общее количество функций во Vuex, включая пользовательские функции и встроенные функции JavaScript, используемые в анализируемом коде, если они учитываются инструментом."
  },
  {
    order: 46,
    metric: "VUEX_AVG_FN_SIZE",
    translation: "Средний размер функции Vuex.",
    description: "Среднее количество строк кода на одну функцию во Vuex-части проекта."
  },
  {
    order: 47,
    metric: "VUEX_FILES",
    translation: "Файлы Vuex.",
    description: "Количество файлов, относящихся к Vuex."
  },
  {
    order: 48,
    metric: "VUEX_CC_AVG",
    translation: "Средняя цикломатическая сложность Vuex.",
    description: "Среднее значение цикломатической сложности по функциям или файлам Vuex."
  },
  {
    order: 49,
    metric: "VUEX_CC_SUM",
    translation: "Суммарная цикломатическая сложность Vuex.",
    description: "Суммарное значение цикломатической сложности во Vuex-части проекта."
  },
  {
    order: 50,
    metric: "VUEX_NEST_MAX",
    translation: "Максимальная глубина вложенности Vuex.",
    description:
      "Максимальная глубина вложенных конструкций, например if, loops или try, во Vuex-коде."
  },
  {
    order: 51,
    metric: "VUEX_PARAMS_MAX",
    translation: "Максимальное число параметров Vuex.",
    description: "Максимальное количество параметров у одной функции во Vuex."
  },
  {
    order: 52,
    metric: "VUEX_HAL_VOL",
    translation: "Объём Холстеда Vuex.",
    description:
      "Метрика Холстеда, отражающая объём Vuex-кода на основе количества операторов и операндов."
  },
  {
    order: 53,
    metric: "VUEX_HAL_DIFF",
    translation: "Трудность Холстеда Vuex.",
    description: "Метрика Холстеда, оценивающая сложность понимания или реализации Vuex-кода."
  },
  {
    order: 54,
    metric: "VUEX_HAL_EFF",
    translation: "Усилие Холстеда Vuex.",
    description: "Метрика Холстеда, оценивающая трудозатраты на понимание или реализацию Vuex-кода."
  },
  {
    order: 55,
    metric: "VUEX_SIM_INT",
    translation: "Внутреннее сходство Vuex.",
    description: "Процент внутреннего сходства или дублирования внутри Vuex-кода."
  },
  {
    order: 56,
    metric: "VUEX_MAINT",
    translation: "Сопровождаемость Vuex.",
    description:
      "Индекс или оценка сопровождаемости Vuex-части проекта, агрегирующая размер, сложность и другие показатели."
  },
  {
    order: 57,
    metric: "VUEX_TS_ANY",
    translation: "Тип any в TypeScript-коде Vuex.",
    description: "Количество использований типа any внутри Vuex-кода."
  },
  {
    order: 58,
    metric: "VUEX_FORCE_UPDATE",
    translation: "Принудительные обновления Vuex.",
    description:
      "Количество вызовов принудительного обновления, обнаруженных в логике, связанной с Vuex."
  },
  {
    order: 59,
    metric: "VUEX_REF_OBJARR",
    translation: "ref для object или array во Vuex.",
    description:
      "Количество случаев использования ref для object или array в участках кода, отнесённых к Vuex."
  },
  {
    order: 60,
    metric: "VUEX_DOM_CALLS",
    translation: "Прямые обращения к DOM во Vuex.",
    description: "Количество прямых обращений к DOM внутри Vuex-кода или связанной логики."
  },
  {
    order: 61,
    metric: "VUEX_COG_COMPLEX",
    translation: "Когнитивная сложность Vuex.",
    description: "Оценка сложности понимания Vuex-кода по метрике Cognitive Complexity."
  }
];

export const GLOSSARY_METRICS_BY_SECTION: Record<GlossarySection, GlossaryMetric[]> = {
  html: HTML_GLOSSARY_METRICS,
  css: CSS_GLOSSARY_METRICS,
  git: GIT_GLOSSARY_METRICS,
  javascript: JAVASCRIPT_GLOSSARY_METRICS,
  typescript: TYPESCRIPT_GLOSSARY_METRICS,
  vue: VUE_GLOSSARY_METRICS
};
