// Every Loops & Control example below is written out the long way, the way a
// student would write it in C or Java: counters, flags, accumulators, IF /
// ELSE IF / ELSE ladders, WHILE conditions and small helper FUNCTIONs. No
// shortcut built-ins (MAX, MIN, ...) are used, so every decision the program
// makes is visible in the code and in the animation. Loop bounds come from
// LENGTH(...), so you can change the numbers in DECLARE and the run is still
// correct.
//
// Colour legend used across the examples:
//   HIGHLIGHT arr[i]              amber, only for the current step ("looking at this")
//   HIGHLIGHT arr[i] 'SUCCESS'    green, stays ("passes the test / the answer")
//   HIGHLIGHT arr[i] 'MARKED'     purple, stays ("best so far / special")
//   HIGHLIGHT arr[i] 'DISCARDED'  grey, stays ("skipped / ruled out")
//   HIGHLIGHT arr[i] 'NEUTRAL'    back to the normal blue
//
// Language facts the examples rely on (and teach):
//   * LOOP i FROM a TO b includes BOTH ends: LOOP i FROM 0 TO 4 runs 5 times.
//     The last index of an array is LENGTH(arr) - 1.
//   * LOOP counts DOWN when b < a, so LOOP i FROM 1 TO 0 runs twice (1, 0),
//     not zero times. When a range may be empty, use a WHILE loop instead.
//   * There is no BREAK or CONTINUE. To stop early, put a flag in the WHILE
//     condition; to skip an item, wrap the work in IF / ELSE.
//   * A variable first assigned inside a LOOP / WHILE / IF body only exists
//     inside that body. Create counters and results BEFORE the loop.
//   * Inside a FUNCTION, assigning to a name creates a local variable, even if
//     the SEQUENCE has a variable with the same name. Send results back with
//     RETURN.
//   * "/" is real division (7 / 2 = 3.5). Whole-number division by 10 is
//     written (n - n % 10) / 10: first remove the last digit, then divide.
//   * AND / OR short-circuit: in "i < n AND arr[i] != target", arr[i] is only
//     read while i is still a valid index.

export const LoopScripts = {
  ForLoopBasics: `SCENE ForLoopBasics

DECLARE
  ARRAY marks = [72, 85, 64, 90, 58]

SEQUENCE
  // LOOP is AQVL's "for loop". It repeats its body once for every value of
  // the loop variable: LOOP i FROM 0 TO 4 runs with i = 0, 1, 2, 3, 4.
  // Both ends are included, so to visit every cell of an array we go from
  // index 0 up to LENGTH(marks) - 1 (the last valid index).
  n = LENGTH(marks)
  PRINT "The class has " + n + " students"

  // Counters are created BEFORE the loop, so they still exist after it
  iterations = 0
  passed = 0
  LOOP i FROM 0 TO n - 1
    HIGHLIGHT marks[i]
    PRINT "Student " + (i + 1) + " (index " + i + ") scored " + marks[i]
    IF marks[i] >= 60
      passed = passed + 1
      HIGHLIGHT marks[i] 'SUCCESS'
    END
    iterations = iterations + 1
  END
  PRINT "The loop body ran " + iterations + " times, once per student"
  PRINT passed + " of " + n + " students scored 60 or more"

  // A loop does not need an array: here it walks the numbers 1 to 10
  // and adds each one to a running sum.
  sum = 0
  LOOP k FROM 1 TO 10
    sum = sum + k
  END
  PRINT "1 + 2 + ... + 10 = " + sum

  // The loop variable can step through any pattern you compute from it:
  // 2 * k gives the even numbers 2, 4, 6, 8, 10.
  evens = ""
  LOOP k FROM 1 TO 5
    evens = evens + (2 * k) + " "
  END
  PRINT "First five even numbers: " + evens
END
`,

  WhileLoopDigits: `SCENE WhileLoopDigits

DECLARE
  ARRAY digits = []

SEQUENCE
  // A WHILE loop repeats as long as its condition is true. Use it when you
  // do not know in advance how many rounds you need: we do not know how
  // many digits the number has, so we keep peeling off the last digit
  // until nothing is left.
  number = 90417
  PRINT "Number: " + number

  remaining = number
  digitSum = 0
  reversed = 0
  digitCount = 0

  WHILE remaining > 0
    // n % 10 is the last digit: 90417 % 10 = 7
    lastDigit = remaining % 10
    // Put it at the FRONT of the array, so the array reads left to right
    INSERT digits[0] lastDigit
    digitSum = digitSum + lastDigit
    // Shift reversed one place left and append the digit: 7, 71, 714, ...
    reversed = reversed * 10 + lastDigit
    // Whole-number division by 10 drops the last digit: 90417 -> 9041
    remaining = (remaining - lastDigit) / 10
    digitCount = digitCount + 1
    PRINT "Took digit " + lastDigit + ", " + remaining + " is left"
  END

  PRINT "Digits:" digits
  PRINT "Number of digits: " + digitCount
  PRINT "Sum of digits: " + digitSum
  PRINT "Reversed number: " + reversed

  // The condition is checked BEFORE every round, including the first one.
  // If it is false straight away, the body never runs at all.
  zeroRounds = 0
  remaining = 0
  WHILE remaining > 0
    zeroRounds = zeroRounds + 1
  END
  PRINT "Starting from 0, the WHILE body ran " + zeroRounds + " times"
END
`,

  CountingDownAndReversing: `SCENE CountingDownAndReversing

DECLARE
  ARRAY playlist = [11, 22, 33, 44, 55, 66]

SEQUENCE
  // 1) A countdown with WHILE: the counter goes DOWN by one each round,
  //    and the loop stops once it reaches 0.
  timer = 5
  WHILE timer > 0
    PRINT "T-minus " + timer
    timer = timer - 1
  END
  PRINT "Lift off!"

  // 2) LOOP counts DOWN by itself when TO is smaller than FROM, so this
  //    visits the playlist from the last track to the first.
  n = LENGTH(playlist)
  LOOP i FROM n - 1 TO 0
    HIGHLIGHT playlist[i]
    PRINT "Playing index " + i + ": track " + playlist[i]
  END

  // 3) Two indices walking toward each other reverse the array in place:
  //    swap the two ends, then move both one step inward. The loop stops
  //    when they meet in the middle.
  left = 0
  right = n - 1
  swaps = 0
  WHILE left < right
    SWAP playlist[left] playlist[right]
    left = left + 1
    right = right - 1
    swaps = swaps + 1
  END
  PRINT "Reversed with " + swaps + " swaps:" playlist
END
`,

  GradeCalculator: `SCENE GradeCalculator

DECLARE
  ARRAY marks = [92, 67, 78, 45, 105, 88, 31, 73]

SEQUENCE
  // An IF / ELSE IF / ELSE ladder checks its conditions from top to bottom
  // and runs ONLY the first branch whose condition is true. Because the
  // checks are in order (>= 90 first), a mark of 92 becomes an A and never
  // reaches the ">= 75" test below it.
  //
  //   90 - 100 : A      75 - 89 : B      60 - 74 : C
  //   40 - 59  : D      0 - 39  : F      anything else is invalid
  countA = 0
  countB = 0
  countC = 0
  countD = 0
  countF = 0
  invalid = 0

  LOOP i FROM 0 TO LENGTH(marks) - 1
    mark = marks[i]
    HIGHLIGHT marks[i]
    grade = ""

    IF mark < 0 OR mark > 100
      grade = "invalid (marks must be 0 to 100)"
      invalid = invalid + 1
      HIGHLIGHT marks[i] 'MARKED'
    ELSE IF mark >= 90
      grade = "A"
      countA = countA + 1
      HIGHLIGHT marks[i] 'SUCCESS'
    ELSE IF mark >= 75
      grade = "B"
      countB = countB + 1
    ELSE IF mark >= 60
      grade = "C"
      countC = countC + 1
    ELSE IF mark >= 40
      grade = "D"
      countD = countD + 1
    ELSE
      grade = "F"
      countF = countF + 1
      HIGHLIGHT marks[i] 'DISCARDED'
    END

    PRINT "Student " + (i + 1) + ": " + mark + " -> " + grade
  END

  PRINT "A: " + countA + ", B: " + countB + ", C: " + countC + ", D: " + countD + ", F: " + countF + ", invalid: " + invalid
END
`,

  LeapYearChecker: `SCENE LeapYearChecker

DECLARE
  ARRAY years = [1900, 2000, 2023, 2024, 2100, 2400]

SEQUENCE
  // The leap year rule:
  //   divisible by 4            -> leap year,
  //   EXCEPT divisible by 100   -> not a leap year,
  //   EXCEPT divisible by 400   -> leap year after all.
  // The same rule is written twice, once with nested IFs and once as one
  // condition joined with AND / OR, and both answers are compared.
  leapCount = 0
  agreements = 0

  LOOP i FROM 0 TO LENGTH(years) - 1
    year = years[i]
    HIGHLIGHT years[i]

    // Version 1: nested IFs, one question at a time
    nestedAnswer = FALSE
    IF year % 4 == 0
      IF year % 100 == 0
        IF year % 400 == 0
          nestedAnswer = TRUE
        ELSE
          nestedAnswer = FALSE
        END
      ELSE
        nestedAnswer = TRUE
      END
    ELSE
      nestedAnswer = FALSE
    END

    // Version 2: a single condition with AND / OR
    combinedAnswer = FALSE
    IF (year % 4 == 0 AND year % 100 != 0) OR year % 400 == 0
      combinedAnswer = TRUE
    END

    IF nestedAnswer == combinedAnswer
      agreements = agreements + 1
    END

    IF nestedAnswer == TRUE
      leapCount = leapCount + 1
      HIGHLIGHT years[i] 'SUCCESS'
      PRINT year + " is a leap year (366 days)"
    ELSE
      HIGHLIGHT years[i] 'DISCARDED'
      PRINT year + " is not a leap year (365 days)"
    END
  END

  PRINT leapCount + " of " + LENGTH(years) + " years are leap years"
  PRINT "Both versions agreed on " + agreements + " of " + LENGTH(years) + " years"
END
`,

  WeeklyExpenses: `SCENE WeeklyExpenses

DECLARE
  ARRAY expenses = [450, 1200, 300, 800, 150, 2000, 700]

SEQUENCE
  // An accumulator is a variable that starts at 0 and grows inside the
  // loop. Here one accumulator adds up the money spent, and a counter
  // counts the days that went over the daily budget.
  dailyBudget = 700
  total = 0
  daysOverBudget = 0

  LOOP day FROM 0 TO LENGTH(expenses) - 1
    HIGHLIGHT expenses[day]
    total = total + expenses[day]

    IF expenses[day] > dailyBudget
      daysOverBudget = daysOverBudget + 1
      HIGHLIGHT expenses[day] 'MARKED'
      PRINT "Day " + (day + 1) + ": spent " + expenses[day] + ", over budget by " + (expenses[day] - dailyBudget) + " (running total " + total + ")"
    ELSE
      HIGHLIGHT expenses[day] 'SUCCESS'
      PRINT "Day " + (day + 1) + ": spent " + expenses[day] + ", within budget (running total " + total + ")"
    END
  END

  // The average can only be computed AFTER the loop, once the total is final
  average = total / LENGTH(expenses)
  PRINT "Total spent this week: " + total
  PRINT "Average per day: " + average
  PRINT "Days over the budget of " + dailyBudget + ": " + daysOverBudget

  weeklyBudget = dailyBudget * LENGTH(expenses)
  IF total > weeklyBudget
    PRINT "Over the weekly budget of " + weeklyBudget + " by " + (total - weeklyBudget)
  ELSE
    PRINT "Within the weekly budget of " + weeklyBudget + ", saved " + (weeklyBudget - total)
  END
END
`,

  HottestAndColdestDay: `SCENE HottestAndColdestDay

DECLARE
  ARRAY temps = [31, 34, 29, 36, 33, 27, 35]

SEQUENCE
  // "Best so far": start by assuming day 0 is both the hottest and the
  // coldest, then let every later day challenge the current record.
  // Starting from a real element (not 0 or 1000) works for any values.
  hottest = temps[0]
  hottestDay = 0
  coldest = temps[0]
  coldestDay = 0
  PRINT "Start: day 1 (" + temps[0] + ") is both records so far"

  LOOP i FROM 1 TO LENGTH(temps) - 1
    HIGHLIGHT temps[i]

    COMPARE temps[i] temps[hottestDay]
    IF temps[i] > hottest
      PRINT "Day " + (i + 1) + ": " + temps[i] + " beats the hottest so far (" + hottest + ")"
      hottest = temps[i]
      hottestDay = i
    END

    COMPARE temps[i] temps[coldestDay]
    IF temps[i] < coldest
      PRINT "Day " + (i + 1) + ": " + temps[i] + " beats the coldest so far (" + coldest + ")"
      coldest = temps[i]
      coldestDay = i
    END
  END

  HIGHLIGHT temps[hottestDay] 'SUCCESS'
  HIGHLIGHT temps[coldestDay] 'MARKED'
  PRINT "Hottest: day " + (hottestDay + 1) + " at " + hottest + " degrees"
  PRINT "Coldest: day " + (coldestDay + 1) + " at " + coldest + " degrees"
  PRINT "Temperature range: " + (hottest - coldest) + " degrees"
END
`,

  SecondLargest: `SCENE SecondLargest

DECLARE
  ARRAY scores = [67, 89, 45, 89, 72, 95, 81]

SEQUENCE
  // Find the largest and the second largest DIFFERENT score in one pass.
  // Each score falls into exactly one of three cases, so this is an
  // IF / ELSE IF chain:
  //   1. bigger than the largest  -> the old largest becomes second
  //   2. between second and largest (and not equal to largest) -> new second
  //   3. anything else            -> changes nothing
  // -1 means "no score yet" (all scores are 0 or more).
  largest = -1
  second = -1

  LOOP i FROM 0 TO LENGTH(scores) - 1
    score = scores[i]
    HIGHLIGHT scores[i]

    IF score > largest
      second = largest
      largest = score
      PRINT score + " is a new largest, second is now " + second
    ELSE IF score < largest AND score > second
      second = score
      PRINT score + " is a new second largest"
    ELSE
      PRINT score + " changes nothing"
    END
  END

  // Colour the answers
  LOOP i FROM 0 TO LENGTH(scores) - 1
    IF scores[i] == largest
      HIGHLIGHT scores[i] 'SUCCESS'
    ELSE IF scores[i] == second
      HIGHLIGHT scores[i] 'MARKED'
    END
  END

  IF second == -1
    PRINT "Largest is " + largest + ", there is no second largest"
  ELSE
    PRINT "Largest is " + largest + ", second largest is " + second
  END
END
`,

  StoppingEarly: `SCENE StoppingEarly

DECLARE
  ARRAY rollNumbers = [104, 117, 121, 135, 142, 150, 163]

  // Search for target and return its index, or -1 when it is not there.
  // AQVL has no BREAK, so a "found" flag is part of the WHILE condition:
  // the moment it becomes TRUE, the loop stops checking the rest.
  FUNCTION findRoll(target)
    n = LENGTH(rollNumbers)
    found = FALSE
    foundAt = -1
    i = 0
    checks = 0

    WHILE i < n AND found == FALSE
      HIGHLIGHT rollNumbers[i]
      checks = checks + 1
      IF rollNumbers[i] == target
        found = TRUE
        foundAt = i
        HIGHLIGHT rollNumbers[i] 'SUCCESS'
      ELSE
        HIGHLIGHT rollNumbers[i] 'DISCARDED'
        i = i + 1
      END
    END

    IF found == TRUE
      PRINT "Roll " + target + " found at index " + foundAt + " after " + checks + " checks (stopped early)"
    ELSE
      PRINT "Roll " + target + " is not in the list, all " + checks + " entries were checked"
    END
    RETURN foundAt
  END

  // Paint every cell back to the normal colour before the next search
  FUNCTION resetColours()
    LOOP k FROM 0 TO LENGTH(rollNumbers) - 1
      HIGHLIGHT rollNumbers[k] 'NEUTRAL'
    END
  END

SEQUENCE
  first = findRoll(135)
  resetColours()
  second = findRoll(999)
  PRINT "Results: " + first + " and " + second
END
`,

  SkippingInvalidReadings: `SCENE SkippingInvalidReadings

DECLARE
  ARRAY readings = [23, -1, 25, 24, -1, 999, 26, 22]

SEQUENCE
  // A temperature sensor sends -1 when it is offline and sometimes a
  // glitch like 999. Valid readings are 0 to 60 degrees.
  // AQVL has no CONTINUE: to skip a reading, the IF branch handles the bad
  // case and the ELSE branch does the real work, so a skipped reading
  // never reaches the sum.
  validSum = 0
  validCount = 0
  skipped = 0

  LOOP i FROM 0 TO LENGTH(readings) - 1
    value = readings[i]
    HIGHLIGHT readings[i]

    IF value < 0 OR value > 60
      skipped = skipped + 1
      HIGHLIGHT readings[i] 'DISCARDED'
      PRINT "Reading " + (i + 1) + " = " + value + ": invalid, skipped"
    ELSE
      validSum = validSum + value
      validCount = validCount + 1
      HIGHLIGHT readings[i] 'SUCCESS'
      PRINT "Reading " + (i + 1) + " = " + value + ": used"
    END
  END

  PRINT "Used " + validCount + " readings, skipped " + skipped
  // Guard the division: with no valid readings there is no average
  IF validCount > 0
    PRINT "Average temperature: " + (validSum / validCount)
  ELSE
    PRINT "No valid readings, no average"
  END
END
`,

  DoWhilePinAndAtm: `SCENE DoWhilePinAndAtm

DECLARE
  ARRAY pinAttempts = [1111, 1234, 4321]
  ARRAY requests = [1000, 2500, 3000, 700, 100]

SEQUENCE
  // Part 1: a "do-while" loop, whose body always runs at least once.
  // AQVL has only WHILE, so start the flag as TRUE: the first round is
  // guaranteed, and the body itself decides whether to go again.
  // The user may try the PIN at most 3 times.
  correctPin = 4321
  maxTries = 3
  tries = 0
  loggedIn = FALSE
  tryAgain = TRUE

  WHILE tryAgain == TRUE
    entered = pinAttempts[tries]
    HIGHLIGHT pinAttempts[tries]
    tries = tries + 1

    IF entered == correctPin
      loggedIn = TRUE
      HIGHLIGHT pinAttempts[tries - 1] 'SUCCESS'
      PRINT "Try " + tries + ": PIN accepted"
    ELSE
      HIGHLIGHT pinAttempts[tries - 1] 'DISCARDED'
      triesLeft = maxTries - tries
      IF triesLeft == 1
        PRINT "Try " + tries + ": wrong PIN, 1 try left"
      ELSE
        PRINT "Try " + tries + ": wrong PIN, " + triesLeft + " tries left"
      END
    END

    // Go again only if not logged in, tries remain and there is another attempt to read
    tryAgain = loggedIn == FALSE AND tries < maxTries AND tries < LENGTH(pinAttempts)
  END

  IF loggedIn == FALSE
    PRINT "Card blocked after " + tries + " wrong tries"
  ELSE
    // Part 2: a WHILE loop over the withdrawal requests. A request larger
    // than the balance is declined, but the loop keeps going; it stops
    // when the requests run out or the account is empty.
    balance = 5000
    PRINT "Balance: " + balance
    r = 0
    WHILE r < LENGTH(requests) AND balance > 0
      HIGHLIGHT requests[r]
      IF requests[r] <= balance
        balance = balance - requests[r]
        HIGHLIGHT requests[r] 'SUCCESS'
        PRINT "Withdrew " + requests[r] + ", balance " + balance
      ELSE
        HIGHLIGHT requests[r] 'DISCARDED'
        PRINT "Declined " + requests[r] + ": only " + balance + " available"
      END
      r = r + 1
    END
    PRINT "Final balance: " + balance
  END
END
`,

  FizzBuzz: `SCENE FizzBuzz

DECLARE
  ARRAY nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]

SEQUENCE
  // For every number: divisible by both 3 and 5 -> "FizzBuzz", only by 3 ->
  // "Fizz", only by 5 -> "Buzz", otherwise the number itself.
  // ORDER MATTERS: the "both" test must come first. If "% 3" were checked
  // first, 15 would print "Fizz" and the FizzBuzz branch would never run.
  fizz = 0
  buzz = 0
  fizzBuzz = 0
  plain = 0

  LOOP i FROM 0 TO LENGTH(nums) - 1
    n = nums[i]
    HIGHLIGHT nums[i]

    IF n % 3 == 0 AND n % 5 == 0
      fizzBuzz = fizzBuzz + 1
      HIGHLIGHT nums[i] 'SUCCESS'
      PRINT "FizzBuzz"
    ELSE IF n % 3 == 0
      fizz = fizz + 1
      HIGHLIGHT nums[i] 'MARKED'
      PRINT "Fizz"
    ELSE IF n % 5 == 0
      buzz = buzz + 1
      HIGHLIGHT nums[i] 'MARKED'
      PRINT "Buzz"
    ELSE
      plain = plain + 1
      PRINT n
    END
  END

  PRINT "Fizz: " + fizz + ", Buzz: " + buzz + ", FizzBuzz: " + fizzBuzz + ", plain numbers: " + plain
END
`,

  MultiplicationTable: `SCENE MultiplicationTable

DECLARE
  ARRAY row = [0, 0, 0, 0, 0]

SEQUENCE
  // Nested loops: the INNER loop runs completely for every single round of
  // the OUTER loop. The outer loop picks the table (1 to 5), the inner loop
  // fills the five cells of that table's row.
  size = LENGTH(row)
  grandTotal = 0
  innerRounds = 0

  LOOP table FROM 1 TO size
    line = ""
    LOOP k FROM 1 TO size
      product = table * k
      UPDATE row[k - 1] product
      grandTotal = grandTotal + product
      innerRounds = innerRounds + 1

      // Pad one-digit numbers with an extra space so the columns line up
      IF product < 10
        line = line + " " + product + "  "
      ELSE
        line = line + product + "  "
      END
    END
    PRINT "Table of " + table + ":" row
    PRINT "   " + line
  END

  PRINT "The inner loop body ran " + innerRounds + " times (" + size + " x " + size + ")"
  PRINT "Sum of every number in the table: " + grandTotal
END
`,

  StarPatterns: `SCENE StarPatterns

DECLARE
  ARRAY starsPerRow = []

SEQUENCE
  // Pattern printing is the classic nested-loop exercise: the outer loop
  // chooses the row, the inner loop(s) build that row character by
  // character, and PRINT outputs the finished row.
  rows = 4

  // 1) Right triangle: row r has r stars
  PRINT "Right triangle:"
  LOOP r FROM 1 TO rows
    line = ""
    LOOP s FROM 1 TO r
      line = line + "* "
    END
    PRINT line
  END

  // 2) Pyramid: row r has (rows - r) spaces, then (2r - 1) stars.
  //    The last row has 0 spaces. "LOOP s FROM 1 TO 0" would count DOWN and
  //    run twice, so the spaces are added with a WHILE loop, which
  //    correctly runs zero times when there is nothing to add.
  PRINT "Pyramid:"
  LOOP r FROM 1 TO rows
    line = ""
    spaces = 0
    WHILE spaces < rows - r
      line = line + " "
      spaces = spaces + 1
    END
    stars = 2 * r - 1
    LOOP s FROM 1 TO stars
      line = line + "*"
    END
    INSERT starsPerRow[LENGTH(starsPerRow)] stars
    PRINT line
  END
  PRINT "Stars in each pyramid row:" starsPerRow

  // 3) Floyd's triangle: a counter that keeps growing across all the rows
  PRINT "Floyd's triangle:"
  counter = 1
  LOOP r FROM 1 TO rows
    line = ""
    LOOP s FROM 1 TO r
      line = line + counter + " "
      counter = counter + 1
    END
    PRINT line
  END
  PRINT "Numbers printed: " + (counter - 1)
END
`,

  GiftPairsWithinBudget: `SCENE GiftPairsWithinBudget

DECLARE
  ARRAY prices = [150, 300, 450, 200, 600, 350]

SEQUENCE
  // Find every pair of two DIFFERENT gifts whose prices add up to exactly
  // the budget. The inner loop starts at j = i + 1, so:
  //   * a gift is never paired with itself (j is never equal to i),
  //   * each pair is checked once ((0, 3) is checked, (3, 0) is not).
  // That makes n * (n - 1) / 2 checks: 15 for 6 gifts.
  budget = 650
  n = LENGTH(prices)
  pairsFound = 0
  checks = 0

  LOOP i FROM 0 TO n - 2
    LOOP j FROM i + 1 TO n - 1
      COMPARE prices[i] prices[j]
      checks = checks + 1
      IF prices[i] + prices[j] == budget
        pairsFound = pairsFound + 1
        HIGHLIGHT prices[i] 'SUCCESS'
        HIGHLIGHT prices[j] 'SUCCESS'
        PRINT "Pair " + pairsFound + ": " + prices[i] + " + " + prices[j] + " = " + budget + " (indices " + i + " and " + j + ")"
      END
    END
  END

  PRINT "Checked " + checks + " pairs, " + pairsFound + " fit the budget of " + budget
END
`,

  CountingVowels: `SCENE CountingVowels

DECLARE
  // counts[0] = vowels, counts[1] = consonants, counts[2] = spaces
  ARRAY counts = [0, 0, 0]

SEQUENCE
  // A loop can walk over text too: TEXT_LENGTH gives the number of
  // characters and CHAR_AT(text, i) the character at position i.
  sentence = "loops make computers patient"
  PRINT "Sentence: " + sentence

  LOOP i FROM 0 TO TEXT_LENGTH(sentence) - 1
    ch = CHAR_AT(sentence, i)

    IF ch == "a" OR ch == "e" OR ch == "i" OR ch == "o" OR ch == "u"
      UPDATE counts[0] counts[0] + 1
    ELSE IF ch == " "
      UPDATE counts[2] counts[2] + 1
    ELSE IF CHAR_CODE(sentence, i) >= 97 AND CHAR_CODE(sentence, i) <= 122
      // Character codes 97 to 122 are the letters a to z
      UPDATE counts[1] counts[1] + 1
    END
  END

  PRINT "Vowels: " + counts[0]
  PRINT "Consonants: " + counts[1]
  PRINT "Spaces: " + counts[2]
  PRINT "Words: " + (counts[2] + 1)
  PRINT "Counts [vowels, consonants, spaces]:" counts
END
`,

  FibonacciSeries: `SCENE FibonacciSeries

DECLARE
  ARRAY fib = [0, 1]

SEQUENCE
  // Every Fibonacci number is the sum of the two before it:
  // 0, 1, 1, 2, 3, 5, 8, ... The first two are given, so the loop starts
  // at position 2 and each round reads the two previous cells.
  howMany = 12
  LOOP k FROM 2 TO howMany - 1
    nextValue = fib[k - 1] + fib[k - 2]
    INSERT fib[k] nextValue
    HIGHLIGHT fib[k]
  END
  PRINT "First " + howMany + " Fibonacci numbers:" fib

  // Count the even ones with a second loop
  evenCount = 0
  LOOP k FROM 0 TO LENGTH(fib) - 1
    IF fib[k] % 2 == 0
      evenCount = evenCount + 1
      HIGHLIGHT fib[k] 'MARKED'
    END
  END
  PRINT evenCount + " of them are even"

  // When we do not know how many rounds are needed, WHILE is the right loop:
  // keep only the last two numbers and stop at the first one above 1000.
  previous = 0
  current = 1
  seriesIndex = 1
  WHILE current <= 1000
    following = previous + current
    previous = current
    current = following
    seriesIndex = seriesIndex + 1
  END
  PRINT "The first Fibonacci number above 1000 is " + current + " (index " + seriesIndex + " in the series, counting from 0)"
END
`,

  PrimeCheck: `SCENE PrimeCheck

DECLARE
  ARRAY candidates = [2, 9, 17, 21, 29, 1, 49, 97]

  // A prime has no divisor between 2 and its square root. The loop only
  // tries d while d * d <= n, and RETURN leaves the function the moment a
  // divisor is found, so non-primes are rejected early.
  FUNCTION isPrime(n)
    IF n < 2
      RETURN FALSE
    END
    d = 2
    WHILE d * d <= n
      IF n % d == 0
        PRINT "  " + n + " = " + d + " x " + (n / d)
        RETURN FALSE
      END
      d = d + 1
    END
    RETURN TRUE
  END

SEQUENCE
  primeCount = 0
  LOOP i FROM 0 TO LENGTH(candidates) - 1
    HIGHLIGHT candidates[i]
    IF isPrime(candidates[i]) == TRUE
      primeCount = primeCount + 1
      HIGHLIGHT candidates[i] 'SUCCESS'
      PRINT candidates[i] + " is prime"
    ELSE
      HIGHLIGHT candidates[i] 'DISCARDED'
      PRINT candidates[i] + " is not prime"
    END
  END
  PRINT primeCount + " of " + LENGTH(candidates) + " numbers are prime"
END
`,

  SieveOfEratosthenes: `SCENE SieveOfEratosthenes

DECLARE
  ARRAY nums = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]

SEQUENCE
  // The sieve finds every prime up to a limit without dividing at all:
  // take the next number that is not crossed out (it is prime) and cross
  // out all its multiples. A crossed-out number is set to 0 (grey).
  // Index idx holds the number idx + 2, so number m lives at index m - 2.
  n = LENGTH(nums)
  limit = nums[n - 1]

  LOOP i FROM 0 TO n - 1
    p = i + 2
    // Only numbers still standing are primes, and only primes with
    // p * p <= limit have multiples left to cross out
    IF nums[i] != 0 AND p * p <= limit
      HIGHLIGHT nums[i] 'SUCCESS'
      crossedNow = 0
      // Smaller multiples of p were already crossed out by smaller primes
      multiple = p * p
      WHILE multiple <= limit
        idx = multiple - 2
        IF nums[idx] != 0
          UPDATE nums[idx] 0
          HIGHLIGHT nums[idx] 'DISCARDED'
          crossedNow = crossedNow + 1
        END
        multiple = multiple + p
      END
      PRINT "Prime " + p + " crossed out " + crossedNow + " more"
    END
  END

  // Everything still standing is prime
  primes = ""
  primeCount = 0
  LOOP i FROM 0 TO n - 1
    IF nums[i] != 0
      HIGHLIGHT nums[i] 'SUCCESS'
      primes = primes + nums[i] + " "
      primeCount = primeCount + 1
    END
  END
  PRINT "Primes up to " + limit + ": " + primes
  PRINT "There are " + primeCount + " of them"
END
`,

  EuclidGcdLcm: `SCENE EuclidGcdLcm

DECLARE
  ARRAY pair = [180, 48]

SEQUENCE
  // Euclid's algorithm: the GCD of (a, b) is the same as the GCD of
  // (b, a % b). Keep replacing the pair until the second number is 0;
  // the first number is then the GCD. The array shows the pair each round.
  // Keep the original two numbers: a and b change every round
  first = pair[0]
  second = pair[1]
  a = first
  b = second
  PRINT "Find the GCD of " + a + " and " + b
  steps = 0

  WHILE b != 0
    remainder = a % b
    PRINT "  " + a + " % " + b + " = " + remainder
    a = b
    b = remainder
    UPDATE pair[0] a
    UPDATE pair[1] b
    steps = steps + 1
  END
  gcd = a
  HIGHLIGHT pair[0] 'SUCCESS'
  PRINT "GCD = " + gcd + " after " + steps + " remainder steps"

  // LCM from the GCD: first * second = GCD * LCM
  PRINT "LCM = " + (first * second / gcd)

  // The slower, older version subtracts the smaller number from the
  // bigger one until both are equal. Same answer, more rounds.
  x = first
  y = second
  subtractSteps = 0
  WHILE x != y
    IF x > y
      x = x - y
    ELSE
      y = y - x
    END
    subtractSteps = subtractSteps + 1
  END
  PRINT "Subtraction version: GCD = " + x + " after " + subtractSteps + " steps"
END
`,

  DecimalToBinary: `SCENE DecimalToBinary

DECLARE
  ARRAY bits = []

SEQUENCE
  // Divide by 2 again and again: each remainder is one bit, found from the
  // RIGHT end first, so each new bit is inserted at the front.
  number = 37
  remaining = number
  PRINT "Convert " + number + " to binary"

  WHILE remaining > 0
    bit = remaining % 2
    INSERT bits[0] bit
    PRINT "  " + remaining + " / 2 leaves remainder " + bit
    remaining = (remaining - bit) / 2
  END
  PRINT number + " in binary:" bits

  // Convert back to check: read the bits left to right, and for every bit
  // double the value so far and add the bit.
  value = 0
  ones = 0
  LOOP i FROM 0 TO LENGTH(bits) - 1
    HIGHLIGHT bits[i]
    value = value * 2 + bits[i]
    IF bits[i] == 1
      ones = ones + 1
      HIGHLIGHT bits[i] 'SUCCESS'
    END
  END
  PRINT "Back to decimal: " + value
  PRINT "It has " + LENGTH(bits) + " bits, " + ones + " of them are 1"

  IF value == number
    PRINT "Round trip correct"
  ELSE
    PRINT "Round trip FAILED"
  END
END
`,

  PalindromeAndArmstrong: `SCENE PalindromeAndArmstrong

DECLARE
  ARRAY numbers = [121, 153, 1221, 370, 9474, 123]

  // How many digits n has, by removing digits until nothing is left
  FUNCTION countDigits(n)
    count = 0
    WHILE n > 0
      n = (n - n % 10) / 10
      count = count + 1
    END
    RETURN count
  END

  // base to the power exp, as repeated multiplication (no built-in power)
  FUNCTION power(base, exp)
    result = 1
    LOOP k FROM 1 TO exp
      result = result * base
    END
    RETURN result
  END

  // The digits of n in reverse order, e.g. 123 -> 321
  FUNCTION reverseNumber(n)
    reversed = 0
    WHILE n > 0
      digit = n % 10
      reversed = reversed * 10 + digit
      n = (n - digit) / 10
    END
    RETURN reversed
  END

  // Armstrong number: equal to the sum of its digits, each raised to the
  // number of digits. 153 = 1^3 + 5^3 + 3^3 = 1 + 125 + 27
  FUNCTION isArmstrong(n)
    digitCount = countDigits(n)
    total = 0
    rest = n
    WHILE rest > 0
      digit = rest % 10
      total = total + power(digit, digitCount)
      rest = (rest - digit) / 10
    END
    RETURN total == n
  END

SEQUENCE
  palindromes = 0
  armstrongs = 0

  LOOP i FROM 0 TO LENGTH(numbers) - 1
    n = numbers[i]
    HIGHLIGHT numbers[i]
    isPalindrome = reverseNumber(n) == n
    armstrong = isArmstrong(n)

    IF isPalindrome == TRUE
      palindromes = palindromes + 1
    END
    IF armstrong == TRUE
      armstrongs = armstrongs + 1
    END

    IF isPalindrome == TRUE AND armstrong == TRUE
      HIGHLIGHT numbers[i] 'SUCCESS'
      PRINT n + ": palindrome and Armstrong"
    ELSE IF isPalindrome == TRUE
      HIGHLIGHT numbers[i] 'SUCCESS'
      PRINT n + ": palindrome (reads " + reverseNumber(n) + " backwards)"
    ELSE IF armstrong == TRUE
      HIGHLIGHT numbers[i] 'MARKED'
      PRINT n + ": Armstrong number (" + countDigits(n) + " digits)"
    ELSE
      HIGHLIGHT numbers[i] 'DISCARDED'
      PRINT n + ": neither (reversed it is " + reverseNumber(n) + ")"
    END
  END

  PRINT "Palindromes: " + palindromes + ", Armstrong numbers: " + armstrongs
END
`,

  CollatzSequence: `SCENE CollatzSequence

DECLARE
  ARRAY trail = []

  // The number of steps n takes to reach 1 under the Collatz rule
  FUNCTION collatzSteps(n)
    steps = 0
    WHILE n != 1
      IF n % 2 == 0
        n = n / 2
      ELSE
        n = 3 * n + 1
      END
      steps = steps + 1
    END
    RETURN steps
  END

SEQUENCE
  // The Collatz rule: if n is even, halve it; if n is odd, make it 3n + 1.
  // Nobody has proved that every start reaches 1, which makes this the
  // perfect WHILE loop: we cannot know the number of rounds in advance.
  start = 6
  n = start
  INSERT trail[0] n
  WHILE n != 1
    IF n % 2 == 0
      n = n / 2
    ELSE
      n = 3 * n + 1
    END
    INSERT trail[LENGTH(trail)] n
    HIGHLIGHT trail[LENGTH(trail) - 1]
  END
  HIGHLIGHT trail[LENGTH(trail) - 1] 'SUCCESS'
  PRINT "Path from " + start + ":" trail
  PRINT "Reached 1 after " + (LENGTH(trail) - 1) + " steps"

  // A WHILE loop inside a LOOP: which start from 1 to 10 takes the longest?
  bestStart = 1
  bestSteps = 0
  LOOP s FROM 1 TO 10
    stepsNeeded = collatzSteps(s)
    PRINT "  start " + s + ": " + stepsNeeded + " steps"
    IF stepsNeeded > bestSteps
      bestSteps = stepsNeeded
      bestStart = s
    END
  END
  PRINT "Longest path from 1 to 10: start " + bestStart + " with " + bestSteps + " steps"
END
`,
};
